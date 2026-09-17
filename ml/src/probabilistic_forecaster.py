"""
Stockali Probabilistic Demand Forecaster Module.

Provides:
- Probabilistic quantile trajectories: P10 (pessimistic), P50 (expected median), P90 (surge peak).
- Demand volatility and standard deviation estimation from stock movement history and demand signals.
- Day-of-week seasonality modeling (Mon-Sun kirana shopping cycles).
"""

import math
from datetime import date, timedelta
from typing import List, Dict, Optional, Tuple

# Standard normal inverse CDF Z-values for key quantiles
Z_SCORES = {
    0.05: -1.64485,
    0.10: -1.28155,
    0.25: -0.67449,
    0.50: 0.00000,
    0.75: 0.67449,
    0.90: 1.28155,
    0.95: 1.64485,
}

# Standard Indian Kirana day-of-week demand multipliers (Monday=0 to Sunday=6)
# High weekend footfall + mid-week replenishment
DEFAULT_DOW_MULTIPLIERS = {
    0: 0.95,  # Monday
    1: 0.90,  # Tuesday (often vegetarian/quiet day)
    2: 0.95,  # Wednesday
    3: 1.00,  # Thursday
    4: 1.10,  # Friday (evening rush)
    5: 1.35,  # Saturday (bulk weekend grocery shopping)
    6: 1.30,  # Sunday (family prep & cooking)
}


def estimate_demand_volatility(
    historical_sales: List[float],
    base_mean: float,
    signal_lift: float = 0.0,
    min_cv: float = 0.20,
) -> float:
    """
    Estimates daily demand standard deviation (sigma).
    If historical sales records exist, calculates sample standard deviation.
    If historical records are sparse, leverages Poisson-like variance with
    Kirana coefficient of variation (CV) floor.
    """
    if len(historical_sales) >= 3:
        n = len(historical_sales)
        sample_mean = sum(historical_sales) / n
        variance = sum((x - sample_mean) ** 2 for x in historical_sales) / (n - 1)
        sample_std = math.sqrt(variance)
        # Ensure standard deviation reflects signal lift uncertainty
        return max(sample_std, base_mean * min_cv, math.sqrt(base_mean))
    else:
        # Poisson demand approximation: variance ~ mean, scaled by grocery volatility factor
        # Higher signal lift introduces higher demand uncertainty
        volatility_factor = max(min_cv, 1.0 / math.sqrt(max(base_mean, 1.0)))
        volatility_factor += min(signal_lift * 0.02, 0.15)
        return max(base_mean * volatility_factor, 1.0)


def compute_demand_quantiles(
    mean_demand: float,
    std_demand: float,
) -> Dict[str, float]:
    """
    Computes P10, P50, and P90 demand quantiles using normal distribution approximation
    with a non-negativity boundary.
    """
    safe_mean = max(0.0, mean_demand)
    safe_std = max(0.1, std_demand)

    p10 = max(0.0, safe_mean + Z_SCORES[0.10] * safe_std)
    p50 = safe_mean
    p90 = max(p50, safe_mean + Z_SCORES[0.90] * safe_std)

    return {
        "p10": round(p10, 2),
        "p50": round(p50, 2),
        "p90": round(p90, 2),
        "std_dev": round(safe_std, 2),
    }


def generate_probabilistic_trajectory(
    start_date: date,
    base_daily_mean: float,
    daily_std: float,
    forecast_days: int = 7,
    dow_multipliers: Optional[Dict[int, float]] = None,
) -> List[Dict]:
    """
    Generates an n-day forward probabilistic demand forecast trajectory.
    
    Returns a list of daily forecast dicts:
    [
      {
        'forecast_date': date,
        'day_of_week': str,
        'p10': float,
        'p50': float,
        'p90': float,
        'seasonality_multiplier': float
      }, ...
    ]
    """
    if dow_multipliers is None:
        dow_multipliers = DEFAULT_DOW_MULTIPLIERS

    dow_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    trajectory = []

    for step in range(1, forecast_days + 1):
        target_date = start_date + timedelta(days=step)
        weekday = target_date.weekday()
        multiplier = dow_multipliers.get(weekday, 1.0)

        # Scale mean and standard deviation by seasonal multiplier
        scaled_mean = base_daily_mean * multiplier
        scaled_std = daily_std * math.sqrt(multiplier)

        quantiles = compute_demand_quantiles(scaled_mean, scaled_std)

        trajectory.append({
            "forecast_date": target_date,
            "day_of_week": dow_names[weekday],
            "p10": quantiles["p10"],
            "p50": quantiles["p50"],
            "p90": quantiles["p90"],
            "seasonality_multiplier": round(multiplier, 2),
        })

    return trajectory
