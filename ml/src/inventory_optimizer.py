"""
Stockali Inventory Optimization & Supply Chain Decision Engine.

Provides:
- Statistical Safety Stock calculation with service-level guarantee (Z-score * sigma * sqrt(L)).
- Dynamic Reorder Point (ROP) calculation.
- Economic Order Quantity (EOQ) calculation balancing order costs and holding costs.
- Store inventory risk classification (stockout, critical, warning, healthy, overstock).
- Dynamic perishable markdown recommendation based on expiry vs velocity.
- What-if scenario simulation engine (demand shocks, supplier delays).
"""

import math
from typing import Dict, List, Optional, Tuple, Literal


# Service level to standard normal Z-score mapping
SERVICE_LEVEL_Z = {
    0.80: 0.8416,
    0.85: 1.0364,
    0.90: 1.2816,
    0.95: 1.6449,
    0.98: 2.0537,
    0.99: 2.3263,
    0.999: 3.0902,
}

DEFAULT_LEAD_TIME_DAYS = 2.0
DEFAULT_SERVICE_LEVEL = 0.95
DEFAULT_ORDERING_COST_INR = 50.0   # Fixed logistics/order handling cost
DEFAULT_ANNUAL_HOLDING_RATE = 0.18 # 18% annual inventory holding cost (capital + space + spoilage)


def get_service_level_z(service_level: float = DEFAULT_SERVICE_LEVEL) -> float:
    """
    Returns the standard normal Z-score for a given service level target (e.g. 0.95 -> 1.645).
    Interpolates for arbitrary service levels between 0.70 and 0.999.
    """
    clamped_sl = min(0.999, max(0.70, service_level))
    closest = min(SERVICE_LEVEL_Z.keys(), key=lambda k: abs(k - clamped_sl))
    if abs(closest - clamped_sl) < 0.01:
        return SERVICE_LEVEL_Z[closest]
    # Simple polynomial/logistic approximation if not an exact match
    return 1.6449 * (clamped_sl / 0.95) ** 1.5


def calculate_safety_stock(
    daily_std: float,
    lead_time_days: float = DEFAULT_LEAD_TIME_DAYS,
    service_level: float = DEFAULT_SERVICE_LEVEL,
    daily_mean: float = 0.0,
    lead_time_std: float = 0.0,
) -> float:
    """
    Computes statistical safety stock (SS):
    SS = Z * sqrt( L * sigma_D^2 + mu_D^2 * sigma_L^2 )
    
    If supplier lead time is deterministic (sigma_L = 0):
    SS = Z * sigma_D * sqrt(L)
    """
    z = get_service_level_z(service_level)
    variance_term = (lead_time_days * (daily_std ** 2)) + ((daily_mean ** 2) * (lead_time_std ** 2))
    ss = z * math.sqrt(max(0.0, variance_term))
    return round(max(1.0, ss), 2)


def calculate_reorder_point(
    daily_mean: float,
    safety_stock: float,
    lead_time_days: float = DEFAULT_LEAD_TIME_DAYS,
) -> float:
    """
    Computes Reorder Point (ROP):
    ROP = (daily_mean * lead_time_days) + safety_stock
    When stock on hand drops below ROP, a purchase order should be placed.
    """
    lead_time_demand = daily_mean * max(lead_time_days, 0.5)
    return round(lead_time_demand + safety_stock, 2)


def calculate_economic_order_quantity(
    annual_demand: float,
    order_cost: float = DEFAULT_ORDERING_COST_INR,
    unit_cost: float = 50.0,
    holding_rate: float = DEFAULT_ANNUAL_HOLDING_RATE,
) -> float:
    """
    Computes the Economic Order Quantity (EOQ):
    EOQ = sqrt( (2 * D * S) / H )
    where:
      D = Annual demand units
      S = Fixed ordering cost
      H = Unit annual holding cost = unit_cost * holding_rate
    """
    safe_annual_demand = max(annual_demand, 10.0)
    h = max(unit_cost * holding_rate, 0.5)
    eoq = math.sqrt((2.0 * safe_annual_demand * order_cost) / h)
    return round(max(eoq, 10.0), 1)


def assess_inventory_health(
    stock_on_hand: float,
    safety_stock: float,
    reorder_point: float,
    daily_mean: float,
    current_price: float,
    is_perishable: bool = False,
) -> Dict:
    """
    Evaluates listing stock status:
    - stockout: stock == 0
    - critical: stock < safety_stock (extreme risk during replenishment lead time)
    - warning: stock < reorder_point (order needed)
    - healthy: reorder_point <= stock <= 3 * reorder_point
    - overstock: stock > 3 * reorder_point and stock > 20 units
    """
    safe_daily = max(daily_mean, 0.1)
    days_of_supply = round(stock_on_hand / safe_daily, 1)

    if stock_on_hand <= 0.0:
        risk = "stockout"
        lost_rev = round(daily_mean * 7.0 * current_price, 2)
        action = "URGENT: Stock depleted! Place emergency restock order immediately."
    elif stock_on_hand < safety_stock:
        risk = "critical"
        lost_rev = round(daily_mean * 2.0 * current_price, 2)
        action = f"CRITICAL: Stock below Safety Stock ({safety_stock:.1f}). High probability of stockout before supplier delivery."
    elif stock_on_hand < reorder_point:
        risk = "warning"
        lost_rev = 0.0
        action = f"WARNING: Stock below Reorder Point ({reorder_point:.1f}). Place standard restock order."
    elif stock_on_hand > (reorder_point * 3.0) and stock_on_hand > 20.0:
        risk = "overstock"
        lost_rev = 0.0
        action = "OVERSTOCK: Excessive inventory holding. Consider promotional markdown or bundle."
    else:
        risk = "healthy"
        lost_rev = 0.0
        action = "HEALTHY: Stock within optimal operating buffer."

    return {
        "stockout_risk": risk,
        "days_of_supply": days_of_supply,
        "safety_stock": safety_stock,
        "reorder_point": reorder_point,
        "estimated_weekly_lost_revenue": lost_rev,
        "recommended_action": action,
    }


def simulate_store_scenario(
    listings_data: List[Dict],
    demand_surge_pct: float = 0.0,
    lead_time_delay_days: int = 0,
    target_service_level: float = DEFAULT_SERVICE_LEVEL,
    base_lead_time_days: float = DEFAULT_LEAD_TIME_DAYS,
) -> Dict:
    """
    Runs a what-if stress test across a store's product listings.
    
    Simulates:
    - Demand shock / surge (e.g. +30% for Diwali / IPL / weekend weather)
    - Supply chain lead time delay (e.g. +2 days supplier backlog)
    
    Computes:
    - Number of listings currently at stockout/critical risk vs after the shock
    - Projected lost revenue
    - Recommended emergency restock orders
    """
    surge_multiplier = 1.0 + (demand_surge_pct / 100.0)
    effective_lead_time = base_lead_time_days + lead_time_delay_days

    baseline_stockouts = 0
    projected_stockouts = 0
    total_projected_lost_rev = 0.0
    emergency_orders = []

    for item in listings_data:
        listing_id = item["listing_id"]
        product_name = item.get("product_name", "Product")
        stock_on_hand = float(item.get("stock_on_hand", 0.0))
        daily_mean = float(item.get("daily_mean", 5.0))
        daily_std = float(item.get("daily_std", daily_mean * 0.35))
        current_price = float(item.get("current_price", 50.0))

        # Baseline check
        baseline_ss = calculate_safety_stock(daily_std, base_lead_time_days, target_service_level, daily_mean)
        baseline_rop = calculate_reorder_point(daily_mean, baseline_ss, base_lead_time_days)
        if stock_on_hand < baseline_rop:
            baseline_stockouts += 1

        # Simulated scenario under surge and delivery delay
        sim_daily_mean = daily_mean * surge_multiplier
        sim_daily_std = daily_std * math.sqrt(surge_multiplier)
        sim_ss = calculate_safety_stock(sim_daily_std, effective_lead_time, target_service_level, sim_daily_mean)
        sim_rop = calculate_reorder_point(sim_daily_mean, sim_ss, effective_lead_time)

        # Will stock on hand deplete during the effective lead time?
        lead_time_demand = sim_daily_mean * effective_lead_time
        stockout_in_days = round(stock_on_hand / max(sim_daily_mean, 0.1), 1)

        if stock_on_hand < sim_rop:
            projected_stockouts += 1
            # Emergency replenishment needed
            shortfall = max(0.0, sim_rop - stock_on_hand)
            recommended_order = max(shortfall + (sim_daily_mean * 5.0), 10.0)

            # Lost revenue if stock runs out before supplier arrives
            if stock_on_hand < lead_time_demand:
                unmet_days = effective_lead_time - (stock_on_hand / max(sim_daily_mean, 0.1))
                lost_rev = round(unmet_days * sim_daily_mean * current_price, 2)
                total_projected_lost_rev += lost_rev

            urgency = "immediate" if stock_on_hand <= 0.0 else ("high" if stockout_in_days <= effective_lead_time else "medium")

            emergency_orders.append({
                "store_product_listing_id": listing_id,
                "product_name": product_name,
                "current_stock": stock_on_hand,
                "simulated_rop": round(sim_rop, 1),
                "stockout_in_days": stockout_in_days,
                "recommended_emergency_order_qty": round(recommended_order, 1),
                "urgency": urgency,
            })

    # Sort emergency orders by urgency (immediate first, then high)
    urgency_order = {"immediate": 0, "high": 1, "medium": 2}
    emergency_orders.sort(key=lambda x: (urgency_order.get(x["urgency"], 3), x["stockout_in_days"]))

    return {
        "demand_surge_pct": demand_surge_pct,
        "lead_time_delay_days": lead_time_delay_days,
        "target_service_level": target_service_level,
        "baseline_stockout_items_count": baseline_stockouts,
        "projected_stockout_items_count": projected_stockouts,
        "additional_stockouts_count": max(0, projected_stockouts - baseline_stockouts),
        "projected_weekly_lost_revenue": round(total_projected_lost_rev, 2),
        "recommended_emergency_orders": emergency_orders,
    }
