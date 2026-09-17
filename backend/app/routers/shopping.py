from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import desc, func

from app.database import get_db
from app.models.users import User
from app.models.retailers import Store, Retailer
from app.models.inventory import StoreProductListing, InventoryRecord
from app.models.catalogue import Product, ProductVariant
from app.models.shopping import ShoppingList, ShoppingListItem
from app.models.events import CustomerEvent
from app.schemas import (
    ShoppingListCreate,
    ShoppingListResponse,
    ShoppingListItemCreate,
    ShoppingListItemUpdate,
    ShoppingListItemStatusUpdate,
    ShoppingListItemResponse,
    ShoppingListStatusUpdate,
    PaginatedShoppingListsResponse,
)
from app.auth_utils import get_current_user

router = APIRouter(tags=["shopping lists & pickup"])


# =========================================================
# Helper Formatter
# =========================================================

def _format_shopping_list_response(slist: ShoppingList, db: Session) -> ShoppingListResponse:
    item_responses = []
    total_items = 0
    estimated_total = 0.0

    store = db.query(Store).filter(Store.id == slist.store_id).first()
    store_name = store.name if store else None

    # Load items with product and inventory information
    for item in slist.items:
        listing = db.query(StoreProductListing).filter(StoreProductListing.id == item.store_product_listing_id).first()
        product_name = None
        brand = None
        variant_label = None
        current_price = 0.0
        qty_on_hand = 0.0

        if listing:
            current_price = float(listing.current_price)
            variant = db.query(ProductVariant).filter(ProductVariant.id == listing.product_variant_id).first()
            if variant:
                variant_label = variant.variant_label
                prod = db.query(Product).filter(Product.id == variant.product_id).first()
                if prod:
                    product_name = prod.name
                    brand = prod.brand
            
            inv = db.query(InventoryRecord).filter(InventoryRecord.store_product_listing_id == listing.id).first()
            if inv:
                qty_on_hand = float(inv.quantity_on_hand)

        item_qty = float(item.quantity)
        subtotal = round(item_qty * current_price, 2)
        total_items += 1
        estimated_total += subtotal

        item_responses.append(
            ShoppingListItemResponse(
                id=item.id,
                shopping_list_id=item.shopping_list_id,
                store_product_listing_id=item.store_product_listing_id,
                quantity=item_qty,
                substitution_allowed=item.substitution_allowed,
                status=item.status,
                product_name=product_name,
                brand=brand,
                variant_label=variant_label,
                current_price=current_price,
                subtotal=subtotal,
                quantity_on_hand=qty_on_hand,
            )
        )

    return ShoppingListResponse(
        id=slist.id,
        customer_id=slist.customer_id,
        store_id=slist.store_id,
        store_name=store_name,
        status=slist.status,
        notes=slist.notes,
        created_at=slist.created_at,
        updated_at=slist.updated_at,
        total_items=total_items,
        estimated_total=round(estimated_total, 2),
        items=item_responses,
    )


def _verify_store_ownership(store_id: UUID, user: User, db: Session) -> Store:
    store = db.query(Store).filter(Store.id == store_id).first()
    if not store:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Store not found")
    
    if user.role == "admin":
        return store

    retailer = db.query(Retailer).filter(Retailer.id == store.retailer_id).first()
    if not retailer or retailer.owner_user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to manage this store's orders",
        )
    return store


# =========================================================
# 1. Customer Shopping List Operations
# =========================================================

@router.post(
    "/shopping-lists",
    response_model=ShoppingListResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new draft shopping list for in-store pickup",
)
def create_shopping_list(
    req: ShoppingListCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    store = db.query(Store).filter(Store.id == req.store_id).first()
    if not store or not store.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Active store not found")

    slist = ShoppingList(
        customer_id=current_user.id,
        store_id=store.id,
        status="draft",
        notes=req.notes,
    )
    db.add(slist)
    db.flush()

    if req.items:
        for item_in in req.items:
            # Validate listing belongs to store
            listing = (
                db.query(StoreProductListing)
                .filter(
                    StoreProductListing.id == item_in.store_product_listing_id,
                    StoreProductListing.store_id == store.id,
                )
                .first()
            )
            if not listing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Product listing '{item_in.store_product_listing_id}' does not belong to store '{store.id}'",
                )
            item = ShoppingListItem(
                shopping_list_id=slist.id,
                store_product_listing_id=listing.id,
                quantity=item_in.quantity,
                substitution_allowed=item_in.substitution_allowed,
                status="pending",
            )
            db.add(item)

    db.commit()
    db.refresh(slist)
    return _format_shopping_list_response(slist, db)


@router.get(
    "/shopping-lists",
    response_model=PaginatedShoppingListsResponse,
    summary="List customer's shopping lists / orders",
)
def list_customer_shopping_lists(
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by list status"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(ShoppingList).filter(ShoppingList.customer_id == current_user.id)
    if status_filter:
        query = query.filter(ShoppingList.status == status_filter)

    total = query.count()
    slists = query.order_by(desc(ShoppingList.created_at)).offset(offset).limit(limit).all()

    items = [_format_shopping_list_response(sl, db) for sl in slists]
    return {
        "items": items,
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get(
    "/shopping-lists/{list_id}",
    response_model=ShoppingListResponse,
    summary="Get details of a specific shopping list",
)
def get_shopping_list(
    list_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    slist = db.query(ShoppingList).filter(ShoppingList.id == list_id).first()
    if not slist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shopping list not found")

    # Authorize: customer owner OR retailer owner of the store OR admin
    if slist.customer_id != current_user.id and current_user.role != "admin":
        # Check if retailer owner
        store = db.query(Store).filter(Store.id == slist.store_id).first()
        retailer = db.query(Retailer).filter(Retailer.id == store.retailer_id).first() if store else None
        if not retailer or retailer.owner_user_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    return _format_shopping_list_response(slist, db)


@router.post(
    "/shopping-lists/{list_id}/items",
    response_model=ShoppingListResponse,
    summary="Add an item to a draft shopping list",
)
def add_item_to_shopping_list(
    list_id: UUID,
    req: ShoppingListItemCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    slist = db.query(ShoppingList).filter(ShoppingList.id == list_id, ShoppingList.customer_id == current_user.id).first()
    if not slist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shopping list not found")
    if slist.status != "draft":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Cannot modify items on list with status '{slist.status}'")

    listing = (
        db.query(StoreProductListing)
        .filter(StoreProductListing.id == req.store_product_listing_id, StoreProductListing.store_id == slist.store_id)
        .first()
    )
    if not listing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Product listing does not belong to this store")

    # Check if item already on list, if so add to quantity
    existing_item = (
        db.query(ShoppingListItem)
        .filter(ShoppingListItem.shopping_list_id == slist.id, ShoppingListItem.store_product_listing_id == listing.id)
        .first()
    )
    if existing_item:
        existing_item.quantity = float(existing_item.quantity) + req.quantity
        existing_item.substitution_allowed = req.substitution_allowed
    else:
        new_item = ShoppingListItem(
            shopping_list_id=slist.id,
            store_product_listing_id=listing.id,
            quantity=req.quantity,
            substitution_allowed=req.substitution_allowed,
            status="pending",
        )
        db.add(new_item)

    slist.updated_at = func.now()
    db.commit()
    db.refresh(slist)
    return _format_shopping_list_response(slist, db)


@router.patch(
    "/shopping-lists/{list_id}/items/{item_id}",
    response_model=ShoppingListResponse,
    summary="Update item quantity or substitution preference on draft list",
)
def update_shopping_list_item(
    list_id: UUID,
    item_id: UUID,
    req: ShoppingListItemUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    slist = db.query(ShoppingList).filter(ShoppingList.id == list_id, ShoppingList.customer_id == current_user.id).first()
    if not slist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shopping list not found")
    if slist.status != "draft":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Cannot edit items on list with status '{slist.status}'")

    item = db.query(ShoppingListItem).filter(ShoppingListItem.id == item_id, ShoppingListItem.shopping_list_id == slist.id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found on this shopping list")

    if req.quantity is not None:
        item.quantity = req.quantity
    if req.substitution_allowed is not None:
        item.substitution_allowed = req.substitution_allowed

    slist.updated_at = func.now()
    db.commit()
    db.refresh(slist)
    return _format_shopping_list_response(slist, db)


@router.delete(
    "/shopping-lists/{list_id}/items/{item_id}",
    response_model=ShoppingListResponse,
    summary="Remove an item from a draft shopping list",
)
def delete_shopping_list_item(
    list_id: UUID,
    item_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    slist = db.query(ShoppingList).filter(ShoppingList.id == list_id, ShoppingList.customer_id == current_user.id).first()
    if not slist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shopping list not found")
    if slist.status != "draft":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Cannot delete items on list with status '{slist.status}'")

    item = db.query(ShoppingListItem).filter(ShoppingListItem.id == item_id, ShoppingListItem.shopping_list_id == slist.id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found on this shopping list")

    db.delete(item)
    slist.updated_at = func.now()
    db.commit()
    db.refresh(slist)
    return _format_shopping_list_response(slist, db)


@router.post(
    "/shopping-lists/{list_id}/submit",
    response_model=ShoppingListResponse,
    summary="Submit draft shopping list for store pickup (fires demand signal event)",
)
def submit_shopping_list(
    list_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    slist = db.query(ShoppingList).filter(ShoppingList.id == list_id, ShoppingList.customer_id == current_user.id).first()
    if not slist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shopping list not found")
    if slist.status != "draft":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"List cannot be submitted from status '{slist.status}'")
    if not slist.items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot submit an empty shopping list")

    slist.status = "submitted"
    slist.updated_at = func.now()

    # Log high-intent demand signal event for ML track
    event = CustomerEvent(
        customer_id=current_user.id,
        event_type="shopping_list_submit",
        store_id=slist.store_id,
        query_text=f"shopping_list_{slist.id}_items_{len(slist.items)}",
    )
    db.add(event)

    db.commit()
    db.refresh(slist)
    return _format_shopping_list_response(slist, db)


@router.post(
    "/shopping-lists/{list_id}/cancel",
    response_model=ShoppingListResponse,
    summary="Customer cancels a shopping list/pickup request",
)
def cancel_shopping_list(
    list_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    slist = db.query(ShoppingList).filter(ShoppingList.id == list_id, ShoppingList.customer_id == current_user.id).first()
    if not slist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shopping list not found")
    if slist.status in ["ready", "collected", "cancelled"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot cancel list when already in status '{slist.status}'",
        )

    slist.status = "cancelled"
    slist.updated_at = func.now()
    db.commit()
    db.refresh(slist)
    return _format_shopping_list_response(slist, db)


# =========================================================
# 2. Retailer Fulfillment & Store Order Management
# =========================================================

@router.get(
    "/stores/{store_id}/orders",
    response_model=PaginatedShoppingListsResponse,
    summary="Retailer views incoming pickup orders for their store",
)
def get_store_orders(
    store_id: UUID,
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by order status"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _verify_store_ownership(store_id, current_user, db)

    query = db.query(ShoppingList).filter(
        ShoppingList.store_id == store_id,
        ShoppingList.status != "draft",  # Retailer only sees submitted/active orders
    )
    if status_filter:
        query = query.filter(ShoppingList.status == status_filter)

    total = query.count()
    slists = query.order_by(desc(ShoppingList.created_at)).offset(offset).limit(limit).all()

    items = [_format_shopping_list_response(sl, db) for sl in slists]
    return {
        "items": items,
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.patch(
    "/stores/{store_id}/orders/{order_id}/status",
    response_model=ShoppingListResponse,
    summary="Update order fulfillment status (accepted, declined, ready, collected, cancelled)",
)
def update_order_status(
    store_id: UUID,
    order_id: UUID,
    req: ShoppingListStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _verify_store_ownership(store_id, current_user, db)

    slist = db.query(ShoppingList).filter(ShoppingList.id == order_id, ShoppingList.store_id == store_id).first()
    if not slist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found for this store")

    # Validate state transitions
    valid_transitions = {
        "submitted": ["accepted", "declined", "cancelled"],
        "accepted": ["ready", "cancelled"],
        "ready": ["collected", "cancelled"],
        "declined": [],
        "collected": [],
        "cancelled": [],
    }

    allowed = valid_transitions.get(slist.status, [])
    if req.status not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Illegal state transition from '{slist.status}' to '{req.status}'. Allowed transitions: {allowed}",
        )

    slist.status = req.status
    slist.updated_at = func.now()
    db.commit()
    db.refresh(slist)
    return _format_shopping_list_response(slist, db)


@router.patch(
    "/stores/{store_id}/orders/{order_id}/items/{item_id}",
    response_model=ShoppingListResponse,
    summary="Retailer updates status of an individual item (confirmed, substituted, unavailable)",
)
def update_order_item_status(
    store_id: UUID,
    order_id: UUID,
    item_id: UUID,
    req: ShoppingListItemStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _verify_store_ownership(store_id, current_user, db)

    slist = db.query(ShoppingList).filter(ShoppingList.id == order_id, ShoppingList.store_id == store_id).first()
    if not slist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found for this store")

    item = db.query(ShoppingListItem).filter(ShoppingListItem.id == item_id, ShoppingListItem.shopping_list_id == slist.id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found on this order")

    item.status = req.status
    slist.updated_at = func.now()
    db.commit()
    db.refresh(slist)
    return _format_shopping_list_response(slist, db)
