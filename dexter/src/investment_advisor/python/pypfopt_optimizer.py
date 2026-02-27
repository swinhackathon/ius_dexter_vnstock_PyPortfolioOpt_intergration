import json
import sys
from typing import Dict, List


def _error(message: str, missing_dependency: bool = False) -> None:
    print(
        json.dumps(
            {
                "error": message,
                "missing_dependency": missing_dependency,
            }
        )
    )


def _normalize_weights(raw: Dict[str, float]) -> Dict[str, float]:
    cleaned = {k: float(v) for k, v in raw.items() if isinstance(v, (int, float)) and v > 0}
    total = sum(cleaned.values())
    if total <= 0:
        return {}
    return {k: v / total for k, v in cleaned.items()}


def _max_weight_for_risk(risk_band: str) -> float:
    if risk_band == "conservative":
        return 0.35
    if risk_band == "aggressive":
        return 0.75
    return 0.50


def _compute_weight_bound(risk_band: str, asset_count: int) -> float:
    base = _max_weight_for_risk(risk_band)
    if asset_count <= 0:
        return 1.0
    # Keep the optimizer feasible: sum(weights)=1 with long-only requires max_w >= 1/N.
    return min(1.0, max(base, 1.0 / float(asset_count)))


def _optimize_with_fallbacks(ef, risk_band: str):
    warnings: List[str] = []

    if risk_band == "conservative":
        ef.min_volatility()
        return warnings

    if risk_band == "aggressive":
        try:
            ef.max_quadratic_utility(risk_aversion=0.3)
            return warnings
        except Exception as exc:
            warnings.append(
                f"Aggressive objective fallback: max_quadratic_utility failed ({exc}); trying max_sharpe."
            )
            try:
                ef.max_sharpe(risk_free_rate=0.0)
                return warnings
            except Exception as exc2:
                warnings.append(
                    f"Aggressive objective fallback: max_sharpe failed ({exc2}); using min_volatility."
                )
                ef.min_volatility()
                return warnings

    # Moderate/default path
    try:
        ef.max_sharpe(risk_free_rate=0.0)
        return warnings
    except Exception as exc:
        warnings.append(
            f"Moderate objective fallback: max_sharpe failed ({exc}); trying max_quadratic_utility."
        )
        try:
            ef.max_quadratic_utility(risk_aversion=1.0)
            return warnings
        except Exception as exc2:
            warnings.append(
                f"Moderate objective fallback: max_quadratic_utility failed ({exc2}); using min_volatility."
            )
            ef.min_volatility()
            return warnings


def _build_price_frame(price_history: Dict[str, List[dict]]):
    import pandas as pd

    series = {}
    for symbol, rows in price_history.items():
        points = {}
        for row in rows:
            if not isinstance(row, dict):
                continue
            date = row.get("date")
            close = row.get("close")
            if not date:
                continue
            try:
                price = float(close)
            except (TypeError, ValueError):
                continue
            if price <= 0:
                continue
            points[str(date)] = price
        if len(points) >= 20:
            series[symbol] = pd.Series(points, name=symbol)

    if len(series) < 2:
        return None

    frame = pd.concat(series.values(), axis=1).sort_index().dropna()
    if frame.shape[0] < 20:
        return None
    return frame


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except Exception as exc:
        _error(f"Invalid optimizer payload: {exc}")
        return 0

    try:
        from pypfopt import EfficientFrontier, expected_returns, risk_models
    except Exception as exc:
        _error(f"PyPortfolioOpt import failed: {exc}", missing_dependency=True)
        return 0

    risk_band = str(payload.get("risk_band", "moderate")).lower()
    price_history = payload.get("price_history", {})
    if not isinstance(price_history, dict):
        _error("price_history must be an object")
        return 0

    frame = _build_price_frame(price_history)
    if frame is None:
        _error("Not enough aligned market data to optimize portfolio")
        return 0

    try:
        mu = expected_returns.ema_historical_return(frame, frequency=252, span=120)
        cov = risk_models.CovarianceShrinkage(frame, frequency=252).ledoit_wolf()
        max_weight = _compute_weight_bound(risk_band, frame.shape[1])
        ef = EfficientFrontier(mu, cov, weight_bounds=(0.0, max_weight))
        warnings = _optimize_with_fallbacks(ef, risk_band)

        cleaned = ef.clean_weights(cutoff=1e-4, rounding=6)
        normalized = _normalize_weights(cleaned)
        if not normalized:
            _error("Optimizer returned empty weights")
            return 0

        output = {
            "method": "pypfopt",
            "weights": normalized,
        }
        if warnings:
            output["warning"] = " | ".join(warnings)

        print(json.dumps(output))
        return 0
    except Exception as exc:
        _error(f"Optimization failed: {exc}")
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
