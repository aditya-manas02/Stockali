from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import desc, func

from app.database import get_db
from app.models.users import User
from app.models.retailers import Store
from app.models.catalogue import Product, ProductVariant
from app.models.inventory import StoreProductListing
from app.models.notifications import RestockSubscription, Notification
from app.models.events import CustomerEvent
from app.schemas import (
    RestockSubscriptionCreate,
    RestockSubscriptionResponse,
    NotificationResponse,
    PaginatedNotificationsResponse,
)
from app.auth_utils import get_current_user

router = APIRouter(tags=["subscriptions & notifications"])


def _format_subscription_response(sub: RestockSubscription, db: Session) -> RestockSubscriptionResponse:
    listing = db.query(StoreProductListing).filter(StoreProductListing.id == sub.store_product_listing_id).first()
    product_name = None
    brand = None
    variant_label = None
    store_name = None

    if listing:
        store = db.query(Store).filter(Store.id == listing.store_id).first()
        if store:
            store_name = store.name

        variant = db.query(ProductVariant).filter(ProductVariant.id == listing.product_variant_id).first()
        if variant:
            variant_label = variant.variant_label
            prod = db.query(Product).filter(Product.id == variant.product_id).first()
            if prod:
                product_name = prod.name
                brand = prod.brand

    return RestockSubscriptionResponse(
        id=sub.id,
        customer_id=sub.customer_id,
        store_product_listing_id=sub.store_product_listing_id,
        product_name=product_name,
        brand=brand,
        variant_label=variant_label,
        store_name=store_name,
        created_at=sub.created_at,
        notified_at=sub.notified_at,
    )


# =========================================================
# 1. Restock Subscriptions
# =========================================================

@router.post(
    "/subscriptions/restock",
    response_model=RestockSubscriptionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Subscribe to restock alerts for an out-of-stock product listing",
)
def create_restock_subscription(
    req: RestockSubscriptionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    listing = (
        db.query(StoreProductListing)
        .filter(StoreProductListing.id == req.store_product_listing_id)
        .first()
    )
    if not listing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Store product listing not found",
        )

    # Check if active unnotified subscription already exists
    existing = (
        db.query(RestockSubscription)
        .filter(
            RestockSubscription.customer_id == current_user.id,
            RestockSubscription.store_product_listing_id == req.store_product_listing_id,
            RestockSubscription.notified_at.is_(None),
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You are already subscribed for restock notifications on this item",
        )

    sub = RestockSubscription(
        customer_id=current_user.id,
        store_product_listing_id=listing.id,
    )
    db.add(sub)

    # Find product_id for customer demand event
    product_id = None
    variant = db.query(ProductVariant).filter(ProductVariant.id == listing.product_variant_id).first()
    if variant:
        product_id = variant.product_id

    # Log restock_subscribe demand signal
    event = CustomerEvent(
        customer_id=current_user.id,
        event_type="restock_subscribe",
        product_id=product_id,
        store_id=listing.store_id,
        query_text=f"restock_sub_{listing.id}",
    )
    db.add(event)

    db.commit()
    db.refresh(sub)
    return _format_subscription_response(sub, db)


@router.get(
    "/subscriptions/restock",
    response_model=List[RestockSubscriptionResponse],
    summary="List current customer's active restock subscriptions",
)
def list_restock_subscriptions(
    active_only: bool = Query(True, description="Only show subscriptions not yet notified"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(RestockSubscription).filter(RestockSubscription.customer_id == current_user.id)
    if active_only:
        query = query.filter(RestockSubscription.notified_at.is_(None))

    subs = query.order_by(desc(RestockSubscription.created_at)).all()
    return [_format_subscription_response(s, db) for s in subs]


@router.delete(
    "/subscriptions/restock/{id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Unsubscribe from a restock alert",
)
def delete_restock_subscription(
    id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sub = (
        db.query(RestockSubscription)
        .filter(RestockSubscription.id == id, RestockSubscription.customer_id == current_user.id)
        .first()
    )
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restock subscription not found",
        )
    db.delete(sub)
    db.commit()
    return None


# =========================================================
# 2. In-App Notifications
# =========================================================

@router.get(
    "/notifications",
    response_model=PaginatedNotificationsResponse,
    summary="Get user's in-app notifications with unread count",
)
def get_notifications(
    unread_only: bool = Query(False, description="Filter only unread notifications"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    base_query = db.query(Notification).filter(Notification.user_id == current_user.id)
    
    unread_count = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id, Notification.is_read == False)
        .count()
    )

    if unread_only:
        base_query = base_query.filter(Notification.is_read == False)

    total = base_query.count()
    notes = base_query.order_by(desc(Notification.created_at)).offset(offset).limit(limit).all()

    items = [NotificationResponse.model_validate(n) for n in notes]
    return {
        "items": items,
        "total": total,
        "unread_count": unread_count,
        "limit": limit,
        "offset": offset,
    }


@router.patch(
    "/notifications/{id}/read",
    response_model=NotificationResponse,
    summary="Mark a specific notification as read",
)
def mark_notification_read(
    id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    note = (
        db.query(Notification)
        .filter(Notification.id == id, Notification.user_id == current_user.id)
        .first()
    )
    if not note:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")

    note.is_read = True
    db.commit()
    db.refresh(note)
    return NotificationResponse.model_validate(note)


@router.post(
    "/notifications/mark-all-read",
    summary="Mark all user's notifications as read",
)
def mark_all_notifications_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False,
    ).update({"is_read": True})
    db.commit()
    return {"message": "All notifications marked as read"}
