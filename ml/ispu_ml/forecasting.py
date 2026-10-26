"""Forecasting indeks 6 polutan per stasiun untuk H+1..H+7 (strategi direct).

Satu LightGBM per (polutan, horizon), pooled lintas stasiun. Fitur hanya memakai data
<= tanggal origin (lag, rolling mean) + kalender tanggal target. Kategori turunan = ambang
ISPU dari max 6 prediksi. Interval = kuantil residual holdout per (polutan, horizon).
"""

import math
from dataclasses import asdict, dataclass, field

import numpy as np
import pandas as pd
from lightgbm import LGBMRegressor

from ispu_ml.ispu import POLLUTANTS, kategori_array
from ispu_ml.metrics import regression_metrics

P = list(POLLUTANTS)
LAGS = (0, 1, 2, 6, 13)
ROLLING = (3, 7, 14)
PRIMARY_METRIC = "mae_pm25_mean"  # rata-rata MAE PM2.5 semua horizon; lebih kecil lebih baik
INTERVAL = (0.1, 0.9)


@dataclass
class ForecastConfig:
    horizons: tuple[int, ...] = tuple(range(1, 8))
    n_estimators: int = 300
    learning_rate: float = 0.05
    num_leaves: int = 15
    min_child_samples: int = 20
    backtest_folds: int = 5
    seed: int = 42


@dataclass
class ForecastBundle:
    models: dict[tuple[str, int], LGBMRegressor]
    feature_columns: list[str]
    stations: list[str]
    config: dict
    quantiles: dict[tuple[str, int], tuple[float, float]] = field(default_factory=dict)


def build_panel(df: pd.DataFrame) -> pd.DataFrame:
    """Seri harian kontinu per stasiun; hari tanpa data = NaN (bukan dibuang)."""
    frames = []
    for station, g in df.groupby("station", sort=True):
        s = g.set_index("tanggal")[P].astype(float)
        idx = pd.date_range(s.index.min(), s.index.max(), freq="D", name="tanggal")
        s = s.reindex(idx).reset_index()
        s.insert(1, "station", station)
        frames.append(s)
    return pd.concat(frames, ignore_index=True)


def build_features(panel: pd.DataFrame, stations: list[str]) -> pd.DataFrame:
    out = panel[["tanggal", "station"]].copy()
    grp = panel.groupby("station", sort=False)
    for p in P:
        for lag in LAGS:
            out[f"{p}_lag{lag}"] = grp[p].shift(lag)
        for w in ROLLING:
            out[f"{p}_roll{w}"] = grp[p].transform(
                lambda x, w=w: x.rolling(w, min_periods=(w + 1) // 2).mean()
            )
    out["max_lag0"] = panel[P].max(axis=1, skipna=False)
    out["station"] = pd.Categorical(out["station"], categories=stations)
    return out


def _horizon_inputs(
    panel: pd.DataFrame, feats: pd.DataFrame, h: int
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.Series]:
    X = feats.copy()
    target_date = X["tanggal"] + pd.Timedelta(days=h)
    X["target_dow"] = target_date.dt.dayofweek
    X["target_month"] = target_date.dt.month
    grp = panel.groupby("station", sort=False)[P]
    y = grp.shift(-h)
    snaive = grp.shift(7 - h)  # nilai pada (tanggal target - 7 hari)
    return X, y, snaive, target_date


def _feature_columns(X: pd.DataFrame) -> list[str]:
    return [c for c in X.columns if c != "tanggal"]


def _fit(
    panel: pd.DataFrame,
    feats: pd.DataFrame,
    cfg: ForecastConfig,
    target_cutoff: pd.Timestamp | None,
) -> ForecastBundle:
    models: dict[tuple[str, int], LGBMRegressor] = {}
    cols: list[str] = []
    for h in cfg.horizons:
        X, y, _, target_date = _horizon_inputs(panel, feats, h)
        cols = _feature_columns(X)
        sel = target_date <= target_cutoff if target_cutoff is not None else True
        for p in P:
            mask = sel & y[p].notna() & X[f"{p}_lag0"].notna()
            models[(p, h)] = LGBMRegressor(
                n_estimators=cfg.n_estimators,
                learning_rate=cfg.learning_rate,
                num_leaves=cfg.num_leaves,
                min_child_samples=cfg.min_child_samples,
                random_state=cfg.seed,
                deterministic=True,
                force_col_wise=True,
                n_jobs=4,
                verbose=-1,
            ).fit(X.loc[mask, cols], y.loc[mask, p])
    return ForecastBundle(
        models=models,
        feature_columns=cols,
        stations=list(feats["station"].cat.categories),
        config=asdict(cfg),
    )


def _predict_long(
    bundle: ForecastBundle, panel: pd.DataFrame, feats: pd.DataFrame, origin_mask: pd.Series
) -> pd.DataFrame:
    """Prediksi + baseline per (origin, stasiun, horizon, polutan) untuk origin terpilih."""
    rows = []
    for h in bundle.config["horizons"]:
        X, y, snaive, _ = _horizon_inputs(panel, feats, h)
        Xs = X.loc[origin_mask]
        for p in P:
            ok = Xs[f"{p}_lag0"].notna()
            yhat = np.full(len(Xs), np.nan)
            if ok.any():
                yhat[ok.to_numpy()] = bundle.models[(p, h)].predict(
                    Xs.loc[ok, bundle.feature_columns]
                )
            rows.append(
                pd.DataFrame(
                    {
                        "origin": Xs["tanggal"].to_numpy(),
                        "station": Xs["station"].astype(str).to_numpy(),
                        "h": h,
                        "pollutant": p,
                        "y": y.loc[origin_mask, p].to_numpy(),
                        "yhat": np.clip(yhat, 0, None),
                        "persistence": Xs[f"{p}_lag0"].to_numpy(),
                        "seasonal_naive": snaive.loc[origin_mask, p].to_numpy(),
                    }
                )
            )
    return pd.concat(rows, ignore_index=True)


METHODS = ("yhat", "persistence", "seasonal_naive")
_METHOD_NAMES = {
    "yhat": "lightgbm",
    "persistence": "persistence",
    "seasonal_naive": "seasonal_naive",
}


def evaluate_long(long: pd.DataFrame) -> dict:
    """MAE/RMSE per (horizon, polutan) dan akurasi kategori turunan per horizon.

    Semua metode dibandingkan pada baris yang sama (y dan ketiga prediksi tersedia).
    """
    common = long.dropna(subset=["y", *METHODS])
    per_h: dict[str, dict] = {}
    for h, gh in common.groupby("h"):
        per_p = {}
        for p, g in gh.groupby("pollutant"):
            per_p[p] = {_METHOD_NAMES[m]: regression_metrics(g["y"], g[m]) for m in METHODS}
        # Kategori butuh keenam polutan lengkap pada origin yang sama.
        wide = gh.pivot_table(
            index=["origin", "station"], columns="pollutant", values=["y", *METHODS]
        ).dropna()
        cat = {}
        if len(wide):
            truth = kategori_array(wide["y"].max(axis=1).to_numpy())
            for m in METHODS:
                pred = kategori_array(wide[m].max(axis=1).to_numpy())
                cat[_METHOD_NAMES[m]] = float(np.mean(pred == truth))
        per_h[str(h)] = {"pollutants": per_p, "category_accuracy": cat, "n_days": len(wide)}

    def mean_mae(method: str, p: str = "pm_duakomalima") -> float:
        vals = [v["pollutants"][p][method]["mae"] for v in per_h.values() if p in v["pollutants"]]
        return float(np.mean(vals)) if vals else float("nan")

    return {
        "per_horizon": per_h,
        "summary": {
            name: {
                PRIMARY_METRIC: mean_mae(name),
                "category_accuracy_mean": float(
                    np.mean([v["category_accuracy"].get(name, np.nan) for v in per_h.values()])
                )
                if per_h
                else float("nan"),
            }
            for name in _METHOD_NAMES.values()
        },
    }


def _quantiles(long: pd.DataFrame) -> dict[tuple[str, int], tuple[float, float]]:
    q: dict[tuple[str, int], tuple[float, float]] = {}
    res = long.dropna(subset=["y", "yhat"]).assign(r=lambda d: d["y"] - d["yhat"])
    for (p, h), g in res.groupby(["pollutant", "h"]):
        q[(p, int(h))] = (float(g["r"].quantile(INTERVAL[0])), float(g["r"].quantile(INTERVAL[1])))
    return q


@dataclass
class ForecastResult:
    eval_bundle: ForecastBundle
    serve_bundle: ForecastBundle
    metrics: dict

    @property
    def primary(self) -> float:
        return self.metrics["holdout"]["summary"]["lightgbm"][PRIMARY_METRIC]


def score(bundle: ForecastBundle, df: pd.DataFrame, cutoff: pd.Timestamp) -> dict:
    """Skor bundle pada origin > cutoff (dipakai untuk menguji ulang champion)."""
    panel = build_panel(df)
    feats = build_features(panel, bundle.stations)
    return evaluate_long(_predict_long(bundle, panel, feats, feats["tanggal"] > cutoff))


def train_forecaster(
    df: pd.DataFrame, cutoff: pd.Timestamp, cfg: ForecastConfig | None = None
) -> ForecastResult:
    cfg = cfg or ForecastConfig()
    panel = build_panel(df)
    stations = sorted(df["station"].unique())
    feats = build_features(panel, stations)

    eval_bundle = _fit(panel, feats, cfg, target_cutoff=cutoff)
    holdout_long = _predict_long(eval_bundle, panel, feats, feats["tanggal"] > cutoff)
    eval_bundle.quantiles = _quantiles(holdout_long)

    # Rolling-origin backtest: expanding window, model dilatih ulang tiap fold.
    last = panel["tanggal"].max()
    step = math.ceil(((last - cutoff).days or 1) / cfg.backtest_folds)
    folds, fold_info = [], []
    for k in range(cfg.backtest_folds):
        c = cutoff + pd.Timedelta(days=k * step)
        if c >= last:
            break
        b = _fit(panel, feats, cfg, target_cutoff=c)
        mask = (feats["tanggal"] > c) & (feats["tanggal"] <= c + pd.Timedelta(days=step))
        folds.append(_predict_long(b, panel, feats, mask))
        fold_info.append({"train_target_until": c.date().isoformat(), "test_days": step})

    serve_bundle = _fit(panel, feats, cfg, target_cutoff=None)
    serve_bundle.quantiles = eval_bundle.quantiles
    holdout = evaluate_long(holdout_long)
    metrics = {
        "primary_metric": PRIMARY_METRIC,
        "holdout": holdout,
        "backtest": evaluate_long(pd.concat(folds, ignore_index=True)) if folds else None,
        "backtest_folds": fold_info,
        "beats_baselines": all(
            holdout["summary"]["lightgbm"][PRIMARY_METRIC] < holdout["summary"][b][PRIMARY_METRIC]
            for b in ("persistence", "seasonal_naive")
        ),
        "interval": list(INTERVAL),
    }
    return ForecastResult(eval_bundle=eval_bundle, serve_bundle=serve_bundle, metrics=metrics)


def forecast(bundle: ForecastBundle, df: pd.DataFrame) -> list[dict]:
    """Forecast H+1..H+n per stasiun dari tanggal data terakhir masing-masing stasiun."""
    panel = build_panel(df)
    feats = build_features(panel, bundle.stations)
    origins = (
        feats.groupby("station", observed=False)["tanggal"].transform("max") == feats["tanggal"]
    )
    out = []
    for h in bundle.config["horizons"]:
        X, _, _, target_date = _horizon_inputs(panel, feats, h)
        Xo = X.loc[origins]
        preds = {}
        for p in P:
            yhat = np.clip(bundle.models[(p, h)].predict(Xo[bundle.feature_columns]), 0, None)
            lo_q, hi_q = bundle.quantiles.get((p, h), (0.0, 0.0))
            preds[p] = (yhat, np.clip(yhat + lo_q, 0, None), np.clip(yhat + hi_q, 0, None))
        for i, (origin, station) in enumerate(
            zip(Xo["tanggal"], Xo["station"].astype(str), strict=True)
        ):
            values = {
                p: {"yhat": float(v[0][i]), "lo": float(v[1][i]), "hi": float(v[2][i])}
                for p, v in preds.items()
            }
            max_yhat = max(v["yhat"] for v in values.values())
            max_hi = max(v["hi"] for v in values.values())
            out.append(
                {
                    "station": station,
                    "origin_date": origin.date(),
                    "target_date": (origin + pd.Timedelta(days=h)).date(),
                    "horizon": h,
                    "values": values,
                    "max_yhat": max_yhat,
                    "critical": max(values, key=lambda k: values[k]["yhat"]),
                    "kategori": str(kategori_array(np.array([max_yhat]))[0]),
                    "kategori_upper": str(kategori_array(np.array([max_hi]))[0]),
                }
            )
    return out
