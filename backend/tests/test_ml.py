"""Tes pipeline ML tanpa database: kebocoran waktu, baseline, reproducibility."""

import numpy as np
import pandas as pd
import pytest
from ispu_ml.classification import rule_predict, train_classification
from ispu_ml.data import holdout_cutoff, snapshot_hash
from ispu_ml.forecasting import (
    ForecastConfig,
    _horizon_inputs,
    build_features,
    build_panel,
    forecast,
    train_forecaster,
)
from ispu_ml.ispu import kategori_array

FAST = ForecastConfig(n_estimators=40, backtest_folds=2)


def test_kategori_array_matches_scalar_thresholds():
    vals = np.array([0, 50, 50.4, 50.6, 100, 101, 200, 201, 300, 301])
    assert list(kategori_array(vals)) == [
        "BAIK", "BAIK", "BAIK", "SEDANG", "SEDANG", "TIDAK SEHAT", "TIDAK SEHAT",
        "SANGAT TIDAK SEHAT", "SANGAT TIDAK SEHAT", "BERBAHAYA",
    ]  # fmt: skip


def test_holdout_is_last_20_percent_of_dates(clean_frame):
    cutoff = holdout_cutoff(clean_frame["tanggal"])
    dates = clean_frame["tanggal"].drop_duplicates()
    assert (dates > cutoff).sum() == 140  # 20% dari 700 tanggal
    assert snapshot_hash(clean_frame) == snapshot_hash(clean_frame.sample(frac=1, random_state=1))


def test_rule_baseline_equals_ispu_category(clean_frame):
    assert (rule_predict(clean_frame) == clean_frame["kategori_ispu"].to_numpy()).all()
    # terhadap label sumber hanya 21 baris yang berbeda
    assert (rule_predict(clean_frame) != clean_frame["kategori"].to_numpy()).sum() == 21


@pytest.fixture(scope="module")
def cls_result(clean_frame):
    return train_classification(clean_frame, holdout_cutoff(clean_frame["tanggal"]), seed=42)


def test_classification_trains_all_candidates(cls_result):
    h = cls_result.metrics["holdout"]
    assert set(h) == {"decision_tree", "random_forest", "knn", "lightgbm", "rule_baseline"}
    assert cls_result.algorithm in h and cls_result.algorithm != "rule_baseline"
    assert h["rule_baseline"]["vs_ispu"]["accuracy"] == 1.0
    assert cls_result.metrics["n_holdout"] + cls_result.metrics["n_train"] == 3131
    assert cls_result.metrics["n_stratified_test"] == 627  # 20% dari 3131, dibulatkan ke atas
    for m in h.values():
        assert len(m["confusion_matrix"]) == len(m["labels"])


def test_classification_reproducible(clean_frame, cls_result):
    again = train_classification(clean_frame, holdout_cutoff(clean_frame["tanggal"]), seed=42)
    assert again.algorithm == cls_result.algorithm
    assert again.metrics["holdout"] == cls_result.metrics["holdout"]


def test_panel_keeps_gaps_as_nan(clean_frame):
    panel = build_panel(clean_frame)
    # DKI2 punya 562 baris dalam rentang 700 hari -> celah harus tetap ada sebagai NaN
    dki2 = panel[panel["station"] == "DKI2"]
    assert dki2["pm_duakomalima"].notna().sum() == 562
    assert dki2["tanggal"].diff().dropna().eq(pd.Timedelta(days=1)).all()


def test_features_use_only_past_and_targets_future(clean_frame):
    panel = build_panel(clean_frame)
    feats = build_features(panel, sorted(clean_frame["station"].unique()))
    X, y, snaive, target_date = _horizon_inputs(panel, feats, h=3)
    s = panel[panel["station"] == "DKI3"].set_index("tanggal")["pm_duakomalima"]
    i = X.index[(X["station"] == "DKI3") & (X["tanggal"] == "2024-06-10")][0]
    assert X.loc[i, "pm_duakomalima_lag0"] == s["2024-06-10"]
    assert X.loc[i, "pm_duakomalima_lag13"] == s["2024-05-28"]
    assert X.loc[i, "pm_duakomalima_roll3"] == pytest.approx(s["2024-06-08":"2024-06-10"].mean())
    assert y.loc[i, "pm_duakomalima"] == s["2024-06-13"]
    assert snaive.loc[i, "pm_duakomalima"] == s["2024-06-06"]  # target - 7 hari
    assert target_date[i] == pd.Timestamp("2024-06-13")


@pytest.fixture(scope="module")
def fc_result(clean_frame):
    return train_forecaster(clean_frame, holdout_cutoff(clean_frame["tanggal"]), FAST)


def test_forecaster_metrics_and_baselines(fc_result):
    m = fc_result.metrics
    assert set(m["holdout"]["per_horizon"]) == {str(h) for h in range(1, 8)}
    s = m["holdout"]["summary"]
    assert set(s) == {"lightgbm", "persistence", "seasonal_naive"}
    for name in s:
        assert 0 < s[name]["mae_pm25_mean"] < 100
    assert len(m["backtest_folds"]) == 2
    assert m["backtest"]["per_horizon"]["1"]["pollutants"]["pm_duakomalima"]["lightgbm"]["n"] > 0


def test_forecast_output_shape_and_interval(clean_frame, fc_result):
    out = forecast(fc_result.serve_bundle, clean_frame)
    assert len(out) == 5 * 7
    last = clean_frame.groupby("station")["tanggal"].max()
    for item in out:
        assert item["origin_date"] == last[item["station"]].date()
        assert (item["target_date"] - item["origin_date"]).days == item["horizon"]
        for v in item["values"].values():
            assert 0 <= v["lo"] <= v["yhat"] + 1e-9 <= v["hi"] + 2e-9
        assert item["kategori"] == kategori_array(np.array([item["max_yhat"]]))[0]


def test_classification_handles_single_member_class(clean_frame):
    df = clean_frame.copy()
    i = df.index[0]
    df.loc[i, ["nitrogen_dioksida", "max"]] = 202
    df.loc[i, ["kategori", "kategori_ispu"]] = "SANGAT TIDAK SEHAT"
    r = train_classification(df, holdout_cutoff(df["tanggal"]), seed=42)
    # baris STS ada di tanggal paling awal -> masuk data latih time split, model tetap terlatih
    assert "SANGAT TIDAK SEHAT" in r.eval_model.classes_
    assert r.metrics["n_stratified_test"] == 627
