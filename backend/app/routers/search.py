from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, func, cast, desc, asc
from geoalchemy2 import Geography

from app.database import get_db
from app.models.retailers import Store
from app.models.catalogue import Product, ProductVariant
from app.models.inventory import StoreProductListing, InventoryRecord
from app.models.events import CustomerEvent
from app.schemas import (
    NearbyStoreResponse,
    PaginatedNearbyStoresResponse,
    NearbyProductSearchResult,
    PaginatedNearbyProductsResponse,
)
from app.geo_utils import point_to_lat_lng, lat_lng_to_point

router = APIRouter(tags=["geospatial search"])


# =========================================================
# 1. Nearby Stores Discovery
# =========================================================

@router.get(
    "/stores/nearby",
    response_model=PaginatedNearbyStoresResponse,
    summary="Find stores within a given radius sorted by distance",
)
def find_nearby_stores(
    latitude: float = Query(..., ge=-90.0, le=90.0, description="Customer latitude coordinate"),
    longitude: float = Query(..., ge=-180.0, le=180.0, description="Customer longitude coordinate"),
    radius_m: float = Query(5000.0, gt=0, le=50000.0, description="Search radius in meters (default 5km, max 50km)"),
    is_active: bool = Query(True, description="Only show active stores"),
    limit: int = Query(20, ge=1, le=100, description="Page limit"),
    offset: int = Query(0, ge=0, description="Page offset"),
    db: Session = Depends(get_db),
):
    # Customer point geography
    customer_geog = cast(
        func.ST_SetSRID(func.ST_MakePoint(longitude, latitude), 4326),
        Geography,
    )

    # PostGIS distance expression
    dist_expr = func.ST_Distance(Store.location, customer_geog).label("distance_meters")

    query = (
        db.query(Store, dist_expr)
        .filter(func.ST_DWithin(Store.location, customer_geog, radius_m))
    )

    if is_active:
        query = query.filter(Store.is_active == True)

    total = query.count()

    results = (
        query.order_by(dist_expr.asc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    items = []
    for store, dist in results:
        lat, lng = point_to_lat_lng(store.location)
        items.append(
            NearbyStoreResponse(
                id=store.id,
                retailer_id=store.retailer_id,
                name=store.name,
                address=store.address,
                latitude=lat if lat is not None else 0.0,
                longitude=lng if lng is not None else 0.0,
                phone=store.phone,
                opening_hours=store.opening_hours,
                is_active=store.is_active,
                distance_meters=round(float(dist), 1),
            )
        )

    # Log store discovery demand event
    event = CustomerEvent(
        event_type="search",
        query_text=f"nearby_stores_radius_{int(radius_m)}m",
        location=lat_lng_to_point(latitude, longitude),
    )
    db.add(event)
    db.commit()

    return {
        "items": items,
        "total": total,
        "limit": limit,
        "offset": offset,
    }


# =========================================================
# 2. Nearby Product Search ("Find products near me")
# =========================================================

@router.get(
    "/search/products",
    response_model=PaginatedNearbyProductsResponse,
    summary="Search for in-stock products in stores near customer coordinates",
)
def search_nearby_products(
    query: Optional[str] = Query(None, description="Product name, brand, or variant label (optional)"),
    latitude: float = Query(..., ge=-90.0, le=90.0, description="Customer latitude coordinate"),
    longitude: float = Query(..., ge=-180.0, le=180.0, description="Customer longitude coordinate"),
    radius_m: float = Query(5000.0, gt=0, le=50000.0, description="Search radius in meters (default 5km, max 50km)"),
    in_stock_only: bool = Query(True, description="Only show listings with quantity > 0"),
    limit: int = Query(20, ge=1, le=100, description="Page limit"),
    offset: int = Query(0, ge=0, description="Page offset"),
    db: Session = Depends(get_db),
):
    customer_geog = cast(
        func.ST_SetSRID(func.ST_MakePoint(longitude, latitude), 4326),
        Geography,
    )

    dist_expr = func.ST_Distance(Store.location, customer_geog).label("store_distance_meters")

    base_query = (
        db.query(
            StoreProductListing,
            Store,
            Product,
            ProductVariant,
            InventoryRecord,
            dist_expr,
        )
        .join(Store, StoreProductListing.store_id == Store.id)
        .join(ProductVariant, StoreProductListing.product_variant_id == ProductVariant.id)
        .join(Product, ProductVariant.product_id == Product.id)
        .join(InventoryRecord, StoreProductListing.id == InventoryRecord.store_product_listing_id)
        .filter(func.ST_DWithin(Store.location, customer_geog, radius_m))
        .filter(Store.is_active == True)
        .filter(StoreProductListing.is_available == True)
    )

    if query and query.strip():
        search_pattern = f"%{query.strip()}%"
        base_query = base_query.filter(
            or_(
                Product.name.ilike(search_pattern),
                Product.brand.ilike(search_pattern),
                ProductVariant.variant_label.ilike(search_pattern),
            )
        )

    if in_stock_only:
        base_query = base_query.filter(InventoryRecord.quantity_on_hand > 0)

    total = base_query.count()

    results = (
        base_query.order_by(dist_expr.asc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    items = []
    first_product_id = None
    for listing, store, product, variant, inv, dist in results:
        if not first_product_id:
            first_product_id = product.id
        items.append(
            NearbyProductSearchResult(
                listing_id=listing.id,
                store_id=store.id,
                store_name=store.name,
                store_address=store.address,
                store_distance_meters=round(float(dist), 1),
                product_id=product.id,
                product_name=product.name,
                brand=product.brand,
                image_url=product.image_url,
                product_variant_id=variant.id,
                variant_label=variant.variant_label,
                barcode=variant.barcode or product.barcode,
                current_price=float(listing.current_price),
                is_available=listing.is_available,
                quantity_on_hand=float(inv.quantity_on_hand),
            )
        )

    # Log customer demand signal for ML layer
    event_type = "search" if total > 0 else "out_of_stock_hit"
    event = CustomerEvent(
        event_type=event_type,
        query_text=query.strip() if query else "browse_nearby",
        product_id=first_product_id,
        location=lat_lng_to_point(latitude, longitude),
    )
    db.add(event)
    db.commit()

    return {
        "items": items,
        "total": total,
        "limit": limit,
        "offset": offset,
    }
