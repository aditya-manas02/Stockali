from typing import Optional, List
from uuid import UUID
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from sqlalchemy.exc import IntegrityError

from app.database import get_db
from app.models.retailers import Store
from app.models.catalogue import Product, ProductVariant
from app.models.inventory import (
    StoreProductListing,
    InventoryRecord,
    PriceHistory,
    StockMovement,
)
from app.schemas import (
    StoreListingCreate,
    StoreListingUpdate,
    StoreListingResponse,
    StoreListingDetailResponse,
    PaginatedStoreListingsResponse,
    StockAdjustmentCreate,
    PriceHistoryResponse,
    StockMovementResponse,
)

router = APIRouter(prefix="/stores/{store_id}/inventory", tags=["store inventory"])


def _format_listing_response(listing: StoreProductListing, db: Session) -> StoreListingResponse:
    """Helper to assemble a StoreListingResponse with denormalized catalogue details."""
    variant = listing.product_variant or db.query(ProductVariant).filter(ProductVariant.id == listing.product_variant_id).first()
    product = None
    if variant:
        product = variant.product or db.query(Product).filter(Product.id == variant.product_id).first()

    inv = listing.inventory or db.query(InventoryRecord).filter(InventoryRecord.store_product_listing_id == listing.id).first()

    return StoreListingResponse(
        id=listing.id,
        store_id=listing.store_id,
        product_variant_id=listing.product_variant_id,
        product_id=product.id if product else None,
        product_name=product.name if product else None,
        brand=product.brand if product else None,
        variant_label=variant.variant_label if variant else None,
        barcode=variant.barcode if (variant and variant.barcode) else (product.barcode if product else None),
        current_price=float(listing.current_price),
        is_available=listing.is_available,
        quantity_on_hand=float(inv.quantity_on_hand) if inv else 0.0,
        reorder_threshold=float(inv.reorder_threshold) if (inv and inv.reorder_threshold is not None) else None,
        last_confirmed_at=listing.last_confirmed_at,
    )


# =========================================================
# Inventory & Listings Endpoints
# =========================================================

@router.post(
    "",
    response_model=StoreListingResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a catalogue product variant to store inventory",
)
def add_product_to_store(
    store_id: UUID,
    listing_in: StoreListingCreate,
    db: Session = Depends(get_db),
):
    # Verify store exists
    store = db.query(Store).filter(Store.id == store_id).first()
    if not store:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Store with id '{store_id}' not found",
        )

    # Verify product variant exists
    variant = db.query(ProductVariant).filter(ProductVariant.id == listing_in.product_variant_id).first()
    if not variant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product variant with id '{listing_in.product_variant_id}' not found",
        )

    # Check for duplicate listing
    existing = (
        db.query(StoreProductListing)
        .filter(
            StoreProductListing.store_id == store_id,
            StoreProductListing.product_variant_id == listing_in.product_variant_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Product variant '{listing_in.product_variant_id}' is already listed in this store",
        )

    # 1. Create listing
    listing = StoreProductListing(
        store_id=store_id,
        product_variant_id=listing_in.product_variant_id,
        current_price=listing_in.current_price,
        is_available=listing_in.is_available,
    )
    db.add(listing)
    db.flush()  # Generate listing.id

    # 2. Create inventory record
    inv = InventoryRecord(
        store_product_listing_id=listing.id,
        quantity_on_hand=listing_in.quantity_on_hand,
        reorder_threshold=listing_in.reorder_threshold,
    )
    db.add(inv)

    # 3. Create initial price history record
    price_entry = PriceHistory(
        store_product_listing_id=listing.id,
        price=listing_in.current_price,
    )
    db.add(price_entry)

    # 4. Record initial stock movement if quantity > 0
    if listing_in.quantity_on_hand > 0:
        movement = StockMovement(
            store_product_listing_id=listing.id,
            change_qty=listing_in.quantity_on_hand,
            reason="restock",
        )
        db.add(movement)

    try:
        db.commit()
        db.refresh(listing)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Integrity error creating store product listing",
        )

    return _format_listing_response(listing, db)


@router.get(
    "",
    response_model=PaginatedStoreListingsResponse,
    summary="List store inventory with filters and pagination",
)
def list_store_inventory(
    store_id: UUID,
    is_available: Optional[bool] = Query(None, description="Filter by availability"),
    in_stock_only: bool = Query(False, description="Filter only items with quantity > 0"),
    search: Optional[str] = Query(None, description="Search by product name, brand, or variant label"),
    limit: int = Query(20, ge=1, le=100, description="Page limit"),
    offset: int = Query(0, ge=0, description="Page offset"),
    db: Session = Depends(get_db),
):
    # Verify store exists
    store = db.query(Store).filter(Store.id == store_id).first()
    if not store:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Store with id '{store_id}' not found",
        )

    query = (
        db.query(StoreProductListing)
        .join(ProductVariant, StoreProductListing.product_variant_id == ProductVariant.id)
        .join(Product, ProductVariant.product_id == Product.id)
        .join(InventoryRecord, StoreProductListing.id == InventoryRecord.store_product_listing_id)
        .filter(StoreProductListing.store_id == store_id)
    )

    if is_available is not None:
        query = query.filter(StoreProductListing.is_available == is_available)

    if in_stock_only:
        query = query.filter(InventoryRecord.quantity_on_hand > 0)

    if search:
        pattern = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Product.name.ilike(pattern),
                Product.brand.ilike(pattern),
                ProductVariant.variant_label.ilike(pattern),
            )
        )

    total = query.count()
    listings = (
        query.order_by(StoreProductListing.last_confirmed_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    items = [_format_listing_response(l, db) for l in listings]
    return {
        "items": items,
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get(
    "/{listing_id}",
    response_model=StoreListingDetailResponse,
    summary="Get single listing details with price history and stock movements",
)
def get_store_listing(
    store_id: UUID,
    listing_id: UUID,
    db: Session = Depends(get_db),
):
    listing = (
        db.query(StoreProductListing)
        .filter(
            StoreProductListing.id == listing_id,
            StoreProductListing.store_id == store_id,
        )
        .first()
    )
    if not listing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Listing '{listing_id}' not found in store '{store_id}'",
        )

    base = _format_listing_response(listing, db)

    recent_prices = [
        PriceHistoryResponse(
            id=p.id,
            store_product_listing_id=p.store_product_listing_id,
            price=float(p.price),
            effective_from=p.effective_from,
        )
        for p in listing.price_history[:10]
    ]

    recent_movements = [
        StockMovementResponse(
            id=m.id,
            store_product_listing_id=m.store_product_listing_id,
            change_qty=float(m.change_qty),
            reason=m.reason,
            created_at=m.created_at,
        )
        for m in listing.stock_movements[:10]
    ]

    return StoreListingDetailResponse(
        **base.model_dump(),
        recent_price_history=recent_prices,
        recent_stock_movements=recent_movements,
    )


def _trigger_restock_notifications(listing: StoreProductListing, db: Session):
    from app.models.notifications import RestockSubscription, Notification

    subs = (
        db.query(RestockSubscription)
        .filter(
            RestockSubscription.store_product_listing_id == listing.id,
            RestockSubscription.notified_at.is_(None),
        )
        .all()
    )
    if not subs:
        return

    prod_name = "A subscribed product"
    variant = db.query(ProductVariant).filter(ProductVariant.id == listing.product_variant_id).first()
    if variant:
        prod = db.query(Product).filter(Product.id == variant.product_id).first()
        if prod:
            prod_name = f"{prod.name} ({variant.variant_label})"

    store = db.query(Store).filter(Store.id == listing.store_id).first()
    store_name = store.name if store else "your local store"

    now_ts = func.now()
    for sub in subs:
        notification = Notification(
            user_id=sub.customer_id,
            channel="in_app",
            title="Product Back in Stock!",
            body=f"Good news! {prod_name} is now back in stock at {store_name}.",
        )
        db.add(notification)
        sub.notified_at = now_ts


@router.patch(
    "/{listing_id}",
    response_model=StoreListingResponse,
    summary="Update price, availability, or stock of a store listing",
)
def update_store_listing(
    store_id: UUID,
    listing_id: UUID,
    update_in: StoreListingUpdate,
    db: Session = Depends(get_db),
):
    listing = (
        db.query(StoreProductListing)
        .filter(
            StoreProductListing.id == listing_id,
            StoreProductListing.store_id == store_id,
        )
        .first()
    )
    if not listing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Listing '{listing_id}' not found in store '{store_id}'",
        )

    inv = listing.inventory
    if not inv:
        inv = InventoryRecord(store_product_listing_id=listing.id, quantity_on_hand=0)
        db.add(inv)

    # 1. Price update
    if update_in.current_price is not None and float(listing.current_price) != float(update_in.current_price):
        listing.current_price = update_in.current_price
        db.add(
            PriceHistory(
                store_product_listing_id=listing.id,
                price=update_in.current_price,
            )
        )

    # 2. Availability update
    if update_in.is_available is not None:
        listing.is_available = update_in.is_available

    # 3. Direct stock level update
    if update_in.quantity_on_hand is not None and float(inv.quantity_on_hand) != float(update_in.quantity_on_hand):
        old_qty = float(inv.quantity_on_hand)
        new_qty = float(update_in.quantity_on_hand)
        delta = new_qty - old_qty
        inv.quantity_on_hand = update_in.quantity_on_hand
        db.add(
            StockMovement(
                store_product_listing_id=listing.id,
                change_qty=delta,
                reason=update_in.stock_change_reason or "adjustment",
            )
        )
        if old_qty <= 0 and new_qty > 0:
            _trigger_restock_notifications(listing, db)

    # 4. Reorder threshold
    if update_in.reorder_threshold is not None:
        inv.reorder_threshold = update_in.reorder_threshold

    listing.last_confirmed_at = func.now()

    db.commit()
    db.refresh(listing)
    return _format_listing_response(listing, db)


@router.post(
    "/{listing_id}/stock-movement",
    response_model=StoreListingResponse,
    summary="Record a stock movement (restock, sale, adjustment, writeoff)",
)
def record_stock_movement(
    store_id: UUID,
    listing_id: UUID,
    movement_in: StockAdjustmentCreate,
    db: Session = Depends(get_db),
):
    listing = (
        db.query(StoreProductListing)
        .filter(
            StoreProductListing.id == listing_id,
            StoreProductListing.store_id == store_id,
        )
        .first()
    )
    if not listing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Listing '{listing_id}' not found in store '{store_id}'",
        )

    inv = listing.inventory
    if not inv:
        inv = InventoryRecord(store_product_listing_id=listing.id, quantity_on_hand=0)
        db.add(inv)

    old_quantity = float(inv.quantity_on_hand)
    new_quantity = old_quantity + float(movement_in.change_qty)
    if new_quantity < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient inventory on hand ({inv.quantity_on_hand}) for deduction of {abs(movement_in.change_qty)}",
        )

    inv.quantity_on_hand = new_quantity
    db.add(
        StockMovement(
            store_product_listing_id=listing.id,
            change_qty=movement_in.change_qty,
            reason=movement_in.reason,
        )
    )

    if old_quantity <= 0 and new_quantity > 0:
        _trigger_restock_notifications(listing, db)

    listing.last_confirmed_at = func.now()

    db.commit()
    db.refresh(listing)
    return _format_listing_response(listing, db)


@router.delete(
    "/{listing_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove a product listing from a store",
)
def remove_store_listing(
    store_id: UUID,
    listing_id: UUID,
    db: Session = Depends(get_db),
):
    listing = (
        db.query(StoreProductListing)
        .filter(
            StoreProductListing.id == listing_id,
            StoreProductListing.store_id == store_id,
        )
        .first()
    )
    if not listing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Listing '{listing_id}' not found in store '{store_id}'",
        )

    db.delete(listing)
    db.commit()
    return None
