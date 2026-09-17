from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database import get_db
from app.models.users import User
from app.models.retailers import Store, Retailer
from app.models.catalogue import Product, ProductVariant
from app.models.inventory import StoreProductListing, PriceHistory
from app.models.ml import (
    DemandForecast,
    RestockRecommendation,
    DiscountRecommendation,
    ModelEvaluation,
)
from app.schemas import (
    DemandForecastResponse,
    RestockRecommendationResponse,
    RestockActionUpdate,
    DiscountRecommendationResponse,
    DiscountActionUpdate,
    ModelEvaluationResponse,
)
from app.auth_utils import get_current_user

router = APIRouter(tags=["ml insights & analytics"])


def _verify_store_access(store_id: UUID, user: User, db: Session) -> Store:
    store = db.query(Store).filter(Store.id == store_id).first()
    if not store:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Store not found")
    if user.role == "admin":
        return store
    retailer = db.query(Retailer).filter(Retailer.id == store.retailer_id).first()
    if not retailer or retailer.owner_user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to view or manage insights for this store",
        )
    return store


def _get_listing_details(listing_id: UUID, db: Session):
    listing = db.query(StoreProductListing).filter(StoreProductListing.id == listing_id).first()
    product_name = None
    brand = None
    variant_label = None
    current_price = 0.0
    current_stock = 0.0

    if listing:
        current_price = float(listing.current_price)
        if listing.inventory:
            current_stock = float(listing.inventory.quantity_on_hand)
        variant = db.query(ProductVariant).filter(ProductVariant.id == listing.product_variant_id).first()
        if variant:
            variant_label = variant.variant_label
            prod = db.query(Product).filter(Product.id == variant.product_id).first()
            if prod:
                product_name = prod.name
                brand = prod.brand

    return listing, product_name, brand, variant_label, current_price, current_stock


# =========================================================
# 1. Demand Forecasts
# =========================================================

@router.get(
    "/stores/{store_id}/insights/forecasts",
    response_model=List[DemandForecastResponse],
    summary="Retrieve upcoming 7-day demand forecasts for store listings",
)
def get_store_forecasts(
    store_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _verify_store_access(store_id, current_user, db)

    forecasts = (
        db.query(DemandForecast)
        .join(StoreProductListing, DemandForecast.store_product_listing_id == StoreProductListing.id)
        .filter(StoreProductListing.store_id == store_id)
        .order_by(DemandForecast.forecast_date.asc())
        .all()
    )

    results = []
    for f in forecasts:
        _, prod_name, brand, var_label, _, _ = _get_listing_details(f.store_product_listing_id, db)
        results.append(
            DemandForecastResponse(
                id=f.id,
                store_product_listing_id=f.store_product_listing_id,
                product_name=prod_name,
                brand=brand,
                variant_label=var_label,
                forecast_date=f.forecast_date,
                predicted_quantity=float(f.predicted_quantity),
                model_version=f.model_version,
                generated_at=f.generated_at,
            )
        )
    return results


# =========================================================
# 2. Restock Recommendations
# =========================================================

@router.get(
    "/stores/{store_id}/insights/restock-recommendations",
    response_model=List[RestockRecommendationResponse],
    summary="Retrieve automated restock recommendations for a store",
)
def get_restock_recommendations(
    store_id: UUID,
    action: Optional[str] = Query(None, description="Filter by action: pending, accepted, adjusted, dismissed"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _verify_store_access(store_id, current_user, db)

    query = (
        db.query(RestockRecommendation)
        .join(StoreProductListing, RestockRecommendation.store_product_listing_id == StoreProductListing.id)
        .filter(StoreProductListing.store_id == store_id)
    )
    if action:
        query = query.filter(RestockRecommendation.retailer_action == action)

    recs = query.order_by(desc(RestockRecommendation.generated_at)).all()

    results = []
    for r in recs:
        _, prod_name, brand, var_label, _, current_stock = _get_listing_details(r.store_product_listing_id, db)
        results.append(
            RestockRecommendationResponse(
                id=r.id,
                store_product_listing_id=r.store_product_listing_id,
                product_name=prod_name,
                brand=brand,
                variant_label=var_label,
                current_stock=current_stock,
                recommended_quantity=float(r.recommended_quantity),
                recommended_by=r.recommended_by,
                confidence=float(r.confidence) if r.confidence is not None else None,
                explanation=r.explanation,
                retailer_action=r.retailer_action or "pending",
                generated_at=r.generated_at,
            )
        )
    return results


@router.patch(
    "/stores/{store_id}/insights/restock-recommendations/{rec_id}/action",
    response_model=RestockRecommendationResponse,
    summary="Retailer accepts, adjusts, or dismisses a restock recommendation",
)
def update_restock_recommendation_action(
    store_id: UUID,
    rec_id: UUID,
    req: RestockActionUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _verify_store_access(store_id, current_user, db)

    rec = (
        db.query(RestockRecommendation)
        .join(StoreProductListing, RestockRecommendation.store_product_listing_id == StoreProductListing.id)
        .filter(RestockRecommendation.id == rec_id, StoreProductListing.store_id == store_id)
        .first()
    )
    if not rec:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Restock recommendation not found")

    rec.retailer_action = req.action
    if req.action == "adjusted" and req.adjusted_quantity is not None:
        rec.recommended_quantity = req.adjusted_quantity

    db.commit()
    db.refresh(rec)

    _, prod_name, brand, var_label, _, current_stock = _get_listing_details(rec.store_product_listing_id, db)
    return RestockRecommendationResponse(
        id=rec.id,
        store_product_listing_id=rec.store_product_listing_id,
        product_name=prod_name,
        brand=brand,
        variant_label=var_label,
        current_stock=current_stock,
        recommended_quantity=float(rec.recommended_quantity),
        recommended_by=rec.recommended_by,
        confidence=float(rec.confidence) if rec.confidence is not None else None,
        explanation=rec.explanation,
        retailer_action=rec.retailer_action,
        generated_at=rec.generated_at,
    )


# =========================================================
# 3. Dynamic Discount Recommendations
# =========================================================

@router.get(
    "/stores/{store_id}/insights/discount-recommendations",
    response_model=List[DiscountRecommendationResponse],
    summary="Retrieve slow-moving and near-expiry discount recommendations",
)
def get_discount_recommendations(
    store_id: UUID,
    action: Optional[str] = Query(None, description="Filter by action: pending, approved, dismissed"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _verify_store_access(store_id, current_user, db)

    query = (
        db.query(DiscountRecommendation)
        .join(StoreProductListing, DiscountRecommendation.store_product_listing_id == StoreProductListing.id)
        .filter(StoreProductListing.store_id == store_id)
    )
    if action:
        query = query.filter(DiscountRecommendation.retailer_action == action)

    recs = query.order_by(desc(DiscountRecommendation.generated_at)).all()

    results = []
    for d in recs:
        _, prod_name, brand, var_label, current_price, _ = _get_listing_details(d.store_product_listing_id, db)
        discount_pct = float(d.recommended_discount_pct)
        discounted_price = round(current_price * (1.0 - discount_pct / 100.0), 2)
        results.append(
            DiscountRecommendationResponse(
                id=d.id,
                store_product_listing_id=d.store_product_listing_id,
                product_name=prod_name,
                brand=brand,
                variant_label=var_label,
                current_price=current_price,
                recommended_discount_pct=discount_pct,
                discounted_price=discounted_price,
                reason=d.reason,
                confidence=float(d.confidence) if d.confidence is not None else None,
                retailer_action=d.retailer_action or "pending",
                generated_at=d.generated_at,
            )
        )
    return results


@router.patch(
    "/stores/{store_id}/insights/discount-recommendations/{rec_id}/action",
    response_model=DiscountRecommendationResponse,
    summary="Retailer approves or dismisses a discount recommendation (approval updates store price)",
)
def update_discount_recommendation_action(
    store_id: UUID,
    rec_id: UUID,
    req: DiscountActionUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _verify_store_access(store_id, current_user, db)

    rec = (
        db.query(DiscountRecommendation)
        .join(StoreProductListing, DiscountRecommendation.store_product_listing_id == StoreProductListing.id)
        .filter(DiscountRecommendation.id == rec_id, StoreProductListing.store_id == store_id)
        .first()
    )
    if not rec:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Discount recommendation not found")

    rec.retailer_action = req.action

    listing, prod_name, brand, var_label, current_price, _ = _get_listing_details(rec.store_product_listing_id, db)
    discount_pct = float(rec.recommended_discount_pct)
    discounted_price = round(current_price * (1.0 - discount_pct / 100.0), 2)

    # If approved: apply discounted price to the live listing in the store
    if req.action == "approved" and listing:
        listing.current_price = discounted_price
        db.add(
            PriceHistory(
                store_product_listing_id=listing.id,
                price=discounted_price,
            )
        )

    db.commit()
    db.refresh(rec)

    return DiscountRecommendationResponse(
        id=rec.id,
        store_product_listing_id=rec.store_product_listing_id,
        product_name=prod_name,
        brand=brand,
        variant_label=var_label,
        current_price=discounted_price if req.action == "approved" else current_price,
        recommended_discount_pct=discount_pct,
        discounted_price=discounted_price,
        reason=rec.reason,
        confidence=float(rec.confidence) if rec.confidence is not None else None,
        retailer_action=rec.retailer_action,
        generated_at=rec.generated_at,
    )


# =========================================================
# 4. Model Evaluations
# =========================================================

@router.get(
    "/insights/model-evaluations",
    response_model=List[ModelEvaluationResponse],
    summary="Retrieve system-wide ML model evaluations and metrics",
)
def get_model_evaluations(
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    evals = (
        db.query(ModelEvaluation)
        .order_by(desc(ModelEvaluation.evaluated_at))
        .limit(limit)
        .all()
    )
    return [
        ModelEvaluationResponse(
            id=e.id,
            model_name=e.model_name,
            model_version=e.model_version,
            evaluated_at=e.evaluated_at,
            metrics=e.metrics or {},
        )
        for e in evals
    ]
