import os
import sys
import math
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

# Ensure ml package is reachable
root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from app.database import get_db
from app.models.users import User
from app.models.retailers import Store, Retailer
from app.models.catalogue import Product, ProductVariant
from app.models.inventory import StoreProductListing, PriceHistory, StockMovement
from app.models.events import CustomerEvent
from app.models.ml import (
    DemandForecast,
    RestockRecommendation,
    DiscountRecommendation,
    ModelEvaluation,
)
from app.geo_utils import point_to_lat_lng
from app.schemas import (
    DemandForecastResponse,
    RestockRecommendationResponse,
    RestockActionUpdate,
    DiscountRecommendationResponse,
    DiscountActionUpdate,
    ModelEvaluationResponse,
    ListingHealthItem,
    InventoryHealthResponse,
    ScenarioSimulationRequest,
    ScenarioSimulationResponse,
    EmergencyOrderItem,
)
from app.auth_utils import get_current_user

from ml.src.features import (
    extract_spatiotemporal_signals,
    reconstruct_censored_demand,
)
from ml.src.probabilistic_forecaster import (
    estimate_demand_volatility,
    compute_demand_quantiles,
)
from ml.src.inventory_optimizer import (
    calculate_safety_stock,
    calculate_reorder_point,
    calculate_economic_order_quantity,
    assess_inventory_health,
    simulate_store_scenario,
    DEFAULT_SERVICE_LEVEL,
    DEFAULT_LEAD_TIME_DAYS,
)

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
        pred = float(f.predicted_quantity)
        sigma = max(pred * 0.22, 1.0)
        p10 = max(0.0, round(pred - 1.28 * sigma, 2))
        p50 = pred
        p90 = round(pred + 1.28 * sigma, 2)
        results.append(
            DemandForecastResponse(
                id=f.id,
                store_product_listing_id=f.store_product_listing_id,
                product_name=prod_name,
                brand=brand,
                variant_label=var_label,
                forecast_date=f.forecast_date,
                predicted_quantity=pred,
                model_version=f.model_version,
                generated_at=f.generated_at,
                p10_quantity=p10,
                p50_quantity=p50,
                p90_quantity=p90,
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


# =========================================================
# 5. Store Inventory Health & Supply Chain Diagnostics
# =========================================================

@router.get(
    "/stores/{store_id}/insights/inventory-health",
    response_model=InventoryHealthResponse,
    summary="Comprehensive inventory health analysis with stockout risk, ROP, Safety Stock, and lost revenue",
)
def get_store_inventory_health(
    store_id: UUID,
    service_level: float = Query(DEFAULT_SERVICE_LEVEL, ge=0.80, le=0.999, description="Target service level probability"),
    lead_time_days: float = Query(DEFAULT_LEAD_TIME_DAYS, ge=0.5, le=30.0, description="Supplier replenishment lead time in days"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    store = _verify_store_access(store_id, current_user, db)
    now_ts = datetime.now(timezone.utc)
    fourteen_days_ago = now_ts - timedelta(days=14)

    store_lat, store_lng = None, None
    if store.location is not None:
        store_lat, store_lng = point_to_lat_lng(store.location)

    listings = (
        db.query(StoreProductListing)
        .filter(StoreProductListing.store_id == store_id, StoreProductListing.is_available == True)
        .all()
    )

    stockout_cnt = 0
    critical_cnt = 0
    warning_cnt = 0
    healthy_cnt = 0
    overstock_cnt = 0
    total_lost_revenue = 0.0

    listings_health: List[ListingHealthItem] = []

    for listing in listings:
        listing_id = listing.id
        current_price = float(listing.current_price)
        inv = listing.inventory
        stock_on_hand = float(inv.quantity_on_hand) if inv else 0.0

        variant = db.query(ProductVariant).filter(ProductVariant.id == listing.product_variant_id).first()
        prod = db.query(Product).filter(Product.id == variant.product_id).first() if variant else None

        prod_name = prod.name if prod else "Product"
        brand = prod.brand if prod else None
        var_label = variant.variant_label if variant else None
        prod_id = prod.id if prod else None
        is_perishable = prod.is_perishable if prod else False

        # Customer demand signals
        events_query = (
            db.query(CustomerEvent)
            .filter(
                CustomerEvent.created_at >= fourteen_days_ago,
                (CustomerEvent.store_id == store_id) | (CustomerEvent.product_id == prod_id),
            )
            .all()
        )
        raw_events = []
        for ev in events_query:
            e_lat, e_lng = point_to_lat_lng(ev.location) if ev.location is not None else (None, None)
            raw_events.append({
                "event_type": ev.event_type,
                "event_time": ev.created_at,
                "lat": e_lat,
                "lng": e_lng,
            })

        signals = extract_spatiotemporal_signals(
            events=raw_events,
            store_lat=store_lat,
            store_lng=store_lng,
            now_ts=now_ts,
        )

        # Sales outflows
        movements = (
            db.query(StockMovement)
            .filter(StockMovement.store_product_listing_id == listing_id, StockMovement.change_qty < 0)
            .all()
        )
        sales_samples = [abs(float(m.change_qty)) for m in movements]
        base_sales_velocity = (sum(sales_samples) / max(len(sales_samples), 1)) if sales_samples else 4.0
        base_sales_velocity = max(base_sales_velocity, 2.0)

        # Reconstruct censored demand
        daily_mean, lost_units = reconstruct_censored_demand(
            stock_on_hand=stock_on_hand,
            observed_sales_velocity=base_sales_velocity,
            weighted_demand_signals=signals["weighted_signal_sum"],
        )

        # Volatility & Quantiles
        daily_std = estimate_demand_volatility(
            historical_sales=sales_samples,
            base_mean=daily_mean,
            signal_lift=signals["weighted_signal_sum"],
        )
        quantiles = compute_demand_quantiles(daily_mean, daily_std)

        # Safety Stock, ROP, EOQ
        safety_stock = calculate_safety_stock(
            daily_std=daily_std,
            lead_time_days=lead_time_days,
            service_level=service_level,
            daily_mean=daily_mean,
        )
        reorder_point = calculate_reorder_point(
            daily_mean=daily_mean,
            safety_stock=safety_stock,
            lead_time_days=lead_time_days,
        )
        annual_demand = daily_mean * 365.0
        eoq = calculate_economic_order_quantity(
            annual_demand=annual_demand,
            unit_cost=current_price * 0.8,
        )

        # Health assessment
        health = assess_inventory_health(
            stock_on_hand=stock_on_hand,
            safety_stock=safety_stock,
            reorder_point=reorder_point,
            daily_mean=daily_mean,
            current_price=current_price,
            is_perishable=is_perishable,
        )

        risk = health["stockout_risk"]
        lost_rev = float(health["estimated_weekly_lost_revenue"])
        total_lost_revenue += lost_rev

        if risk == "stockout":
            stockout_cnt += 1
        elif risk == "critical":
            critical_cnt += 1
        elif risk == "warning":
            warning_cnt += 1
        elif risk == "healthy":
            healthy_cnt += 1
        elif risk == "overstock":
            overstock_cnt += 1

        listings_health.append(
            ListingHealthItem(
                store_product_listing_id=listing_id,
                product_id=prod_id,
                product_name=prod_name,
                brand=brand,
                variant_label=var_label,
                current_price=current_price,
                current_stock=stock_on_hand,
                daily_demand_p10=quantiles["p10"],
                daily_demand_p50=quantiles["p50"],
                daily_demand_p90=quantiles["p90"],
                safety_stock=safety_stock,
                reorder_point=reorder_point,
                economic_order_qty=eoq,
                days_of_supply=health["days_of_supply"],
                stockout_risk=risk,
                estimated_weekly_lost_revenue=lost_rev,
                is_perishable=is_perishable,
                recommended_action=health["recommended_action"],
            )
        )

    return InventoryHealthResponse(
        store_id=store.id,
        store_name=store.name,
        evaluated_at=now_ts,
        total_listings=len(listings),
        stockout_count=stockout_cnt,
        critical_count=critical_cnt,
        warning_count=warning_cnt,
        healthy_count=healthy_cnt,
        overstock_count=overstock_cnt,
        total_estimated_weekly_lost_revenue=round(total_lost_revenue, 2),
        target_service_level=service_level,
        lead_time_days=lead_time_days,
        listings_health=listings_health,
    )


# =========================================================
# 6. Interactive What-If Scenario Simulator
# =========================================================

@router.post(
    "/stores/{store_id}/insights/simulate-scenario",
    response_model=ScenarioSimulationResponse,
    summary="Interactive what-if scenario simulator (demand shocks and supplier lead time delays)",
)
def run_scenario_simulation(
    store_id: UUID,
    req: ScenarioSimulationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    store = _verify_store_access(store_id, current_user, db)
    now_ts = datetime.now(timezone.utc)

    listings = (
        db.query(StoreProductListing)
        .filter(StoreProductListing.store_id == store_id, StoreProductListing.is_available == True)
        .all()
    )

    listings_data = []
    for listing in listings:
        inv = listing.inventory
        stock_on_hand = float(inv.quantity_on_hand) if inv else 0.0
        current_price = float(listing.current_price)

        variant = db.query(ProductVariant).filter(ProductVariant.id == listing.product_variant_id).first()
        prod = db.query(Product).filter(Product.id == variant.product_id).first() if variant else None
        prod_name = prod.name if prod else "Product"

        # Movement velocity
        movements = (
            db.query(StockMovement)
            .filter(StockMovement.store_product_listing_id == listing.id, StockMovement.change_qty < 0)
            .all()
        )
        sales_samples = [abs(float(m.change_qty)) for m in movements]
        daily_mean = (sum(sales_samples) / max(len(sales_samples), 1)) if sales_samples else 4.5
        daily_mean = max(daily_mean, 2.0)
        daily_std = estimate_demand_volatility(sales_samples, daily_mean)

        listings_data.append({
            "listing_id": listing.id,
            "product_name": prod_name,
            "stock_on_hand": stock_on_hand,
            "daily_mean": daily_mean,
            "daily_std": daily_std,
            "current_price": current_price,
        })

    simulation_result = simulate_store_scenario(
        listings_data=listings_data,
        demand_surge_pct=req.demand_surge_pct,
        lead_time_delay_days=req.lead_time_delay_days,
        target_service_level=req.target_service_level,
        base_lead_time_days=DEFAULT_LEAD_TIME_DAYS,
    )

    emergency_items = [
        EmergencyOrderItem(
            store_product_listing_id=o["store_product_listing_id"],
            product_name=o["product_name"],
            current_stock=o["current_stock"],
            simulated_rop=o["simulated_rop"],
            stockout_in_days=o["stockout_in_days"],
            recommended_emergency_order_qty=o["recommended_emergency_order_qty"],
            urgency=o["urgency"],
        )
        for o in simulation_result["recommended_emergency_orders"]
    ]

    return ScenarioSimulationResponse(
        store_id=store.id,
        simulation_timestamp=now_ts,
        demand_surge_pct=req.demand_surge_pct,
        lead_time_delay_days=req.lead_time_delay_days,
        target_service_level=req.target_service_level,
        baseline_stockout_items_count=simulation_result["baseline_stockout_items_count"],
        projected_stockout_items_count=simulation_result["projected_stockout_items_count"],
        additional_stockouts_count=simulation_result["additional_stockouts_count"],
        projected_weekly_lost_revenue=simulation_result["projected_weekly_lost_revenue"],
        recommended_emergency_orders=emergency_items,
    )

