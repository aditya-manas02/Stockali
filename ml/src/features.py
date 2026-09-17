"""
Stockali Spatiotemporal Feature Engineering & Latent Demand Reconstruction Module.

Features:
- Haversine geodesic distance calculation.
- Exponential spatial catchment decay kernel: w = exp(-dist_m / bandwidth_m).
- Temporal half-life decay kernel: w = 0.5 ** (delta_days / half_life_days).
- Censored demand / lost-sales reconstruction for zero-inventory stockouts.
- Full spatiotemporal signal aggregation over customer_events.
"""

import math
from datetime import datetime, timezone
from typing import Optional, List, Dict, Tuple
from uuid import UUID

# Typical kirana delivery / pedestrian catchment radius is ~1.5 km
DEFAULT_SPATIAL_BANDWIDTH_METERS = 1500.0
# Half-life of demand recency (events 3 days ago have 50% decay weight)
DEFAULT_TEMPORAL_HALF_LIFE_DAYS = 3.0
# Latent conversion factor: ratio of searches/OOS hits that would have materialized as purchases
DEFAULT_SEARCH_CONVERSION_RATE = 0.75


def compute_haversine_distance_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Computes great-circle distance between two geographic coordinates in meters
    using the Haversine formula.
    """
    r_earth = 6371000.0  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * (math.sin(delta_lambda / 2.0) ** 2)
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return r_earth * c


def compute_spatial_decay(
    dist_m: Optional[float],
    bandwidth_m: float = DEFAULT_SPATIAL_BANDWIDTH_METERS,
) -> float:
    """
    Computes spatial kernel weight: w = exp(-dist_m / bandwidth_m).
    Events directly at the store have weight 1.0.
    Events at bandwidth distance have weight ~0.368.
    Events without coordinates fallback to average weight 0.5.
    """
    if dist_m is None or dist_m < 0.0:
        return 0.5
    return math.exp(-dist_m / max(bandwidth_m, 100.0))


def compute_temporal_decay(
    delta_days: float,
    half_life_days: float = DEFAULT_TEMPORAL_HALF_LIFE_DAYS,
) -> float:
    """
    Computes exponential recency weight: w = 0.5 ** (delta_days / half_life_days).
    Today's event: weight 1.0.
    3 days ago: weight 0.5.
    6 days ago: weight 0.25.
    """
    safe_delta = max(0.0, delta_days)
    return 0.5 ** (safe_delta / max(half_life_days, 0.5))


def reconstruct_censored_demand(
    stock_on_hand: float,
    observed_sales_velocity: float,
    weighted_demand_signals: float,
    conversion_rate: float = DEFAULT_SEARCH_CONVERSION_RATE,
) -> Tuple[float, float]:
    """
    Solves the retail 'Censored Demand / Lost-Sales Trap':
    When stock is 0, recorded sales drop to 0, which naively tricks simple time-series models
    into forecasting 0 future demand.
    
    Reconstructs latent unfulfilled demand from customer search events, out_of_stock hits,
    and restock subscriptions.
    
    Returns:
        (reconstructed_demand_rate, estimated_lost_sales_units)
    """
    latent_demand_from_signals = weighted_demand_signals * conversion_rate

    if stock_on_hand <= 0.0:
        # Stock is depleted: all signals represent lost sales
        estimated_lost_units = max(observed_sales_velocity, latent_demand_from_signals)
        reconstructed_daily_demand = max(observed_sales_velocity, latent_demand_from_signals)
        return round(reconstructed_daily_demand, 2), round(estimated_lost_units, 2)
    elif stock_on_hand < (observed_sales_velocity * 1.5):
        # Stock is critically low: partial stockout rationing effect
        estimated_lost_units = latent_demand_from_signals * 0.3
        reconstructed_daily_demand = observed_sales_velocity + estimated_lost_units
        return round(reconstructed_daily_demand, 2), round(estimated_lost_units, 2)
    else:
        # Stock is sufficient: signals indicate healthy customer interest / lift
        lift = min(latent_demand_from_signals * 0.15, 10.0)
        reconstructed_daily_demand = observed_sales_velocity + lift
        return round(reconstructed_daily_demand, 2), 0.0


def extract_spatiotemporal_signals(
    events: List[Dict],
    store_lat: Optional[float],
    store_lng: Optional[float],
    now_ts: Optional[datetime] = None,
    spatial_bandwidth_m: float = DEFAULT_SPATIAL_BANDWIDTH_METERS,
    temporal_half_life_days: float = DEFAULT_TEMPORAL_HALF_LIFE_DAYS,
) -> Dict:
    """
    Aggregates a list of customer demand events applying both spatial and temporal kernels.
    
    Events can have:
      - 'event_type': 'search', 'out_of_stock_hit', 'restock_subscribe', 'shopping_list_submit'
      - 'event_time': datetime
      - 'lat': Optional[float]
      - 'lng': Optional[float]
      
    Returns:
      {
        'raw_event_count': int,
        'weighted_signal_sum': float,
        'oos_hit_count': int,
        'restock_sub_count': int,
        'search_count': int,
        'average_distance_meters': Optional[float]
      }
    """
    if now_ts is None:
        now_ts = datetime.now(timezone.utc)

    total_weighted = 0.0
    distances = []
    oos_count = 0
    restock_count = 0
    search_count = 0

    # Event type intent multipliers
    event_weights = {
        "restock_subscribe": 2.5,   # Highest buying intent: user explicitly asked to be notified
        "out_of_stock_hit": 1.8,    # User arrived at store page expecting stock
        "shopping_list_submit": 1.5, # User committed to cart/list
        "search": 1.0,              # Browsing / discovery
    }

    for e in events:
        etype = e.get("event_type", "search")
        base_w = event_weights.get(etype, 1.0)

        # Count by type
        if etype == "out_of_stock_hit":
            oos_count += 1
        elif etype == "restock_subscribe":
            restock_count += 1
        elif etype == "search":
            search_count += 1

        # Temporal decay
        event_time = e.get("event_time", now_ts)
        if event_time.tzinfo is None:
            event_time = event_time.replace(tzinfo=timezone.utc)
        delta_days = (now_ts - event_time).total_seconds() / 86400.0
        w_temp = compute_temporal_decay(delta_days, temporal_half_life_days)

        # Spatial decay
        e_lat = e.get("lat")
        e_lng = e.get("lng")
        if store_lat is not None and store_lng is not None and e_lat is not None and e_lng is not None:
            dist = compute_haversine_distance_m(store_lat, store_lng, e_lat, e_lng)
            distances.append(dist)
            w_spat = compute_spatial_decay(dist, spatial_bandwidth_m)
        else:
            w_spat = 0.5  # Fallback neutral spatial weight

        total_weighted += base_w * w_temp * w_spat

    avg_dist = (sum(distances) / len(distances)) if distances else None

    return {
        "raw_event_count": len(events),
        "weighted_signal_sum": round(total_weighted, 3),
        "oos_hit_count": oos_count,
        "restock_sub_count": restock_count,
        "search_count": search_count,
        "average_distance_meters": round(avg_dist, 1) if avg_dist is not None else None,
    }
