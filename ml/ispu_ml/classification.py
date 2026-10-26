"""Klasifikasi kategori ISPU dari 6 polutan di hari yang sama.

Catatan: kategori ditentukan langsung dari max(6 polutan), jadi aturan ambang adalah
baseline yang hampir sempurna. Model ML dilaporkan apa adanya terhadap baseline ini.
"""

from dataclasses import dataclass, field

import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, clone
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.neighbors import KNeighborsClassifier
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.tree import DecisionTreeClassifier

from ispu_ml.ispu import POLLUTANTS, kategori_array
from ispu_ml.metrics import classification_metrics, ordered_labels

FEATURES = list(POLLUTANTS)
TARGET = "kategori"  # label sumber, sama dengan yang dipakai di Orange
PRIMARY_METRIC = "macro_f1"  # pada time holdout; lebih besar lebih baik


def candidates(seed: int) -> dict[str, BaseEstimator]:
    return {
        "decision_tree": DecisionTreeClassifier(random_state=seed),
        "random_forest": RandomForestClassifier(random_state=seed, n_jobs=4),
        "knn": make_pipeline(StandardScaler(), KNeighborsClassifier(n_neighbors=5)),
    }


def rule_predict(X: pd.DataFrame) -> np.ndarray:
    """Baseline aturan ambang ISPU: kategori dari nilai polutan tertinggi."""
    return kategori_array(X[FEATURES].max(axis=1).to_numpy())


def _evaluate(y_true: pd.Series, y_pred: np.ndarray, y_ispu: pd.Series, labels: list[str]) -> dict:
    m = classification_metrics(y_true, y_pred, labels)
    m["vs_ispu"] = classification_metrics(y_ispu, y_pred, labels)
    m["macro_f1"] = m["macro"]["f1"]
    return m


def score(model: BaseEstimator, holdout: pd.DataFrame) -> dict:
    pred = model.predict(holdout[FEATURES])
    labels = ordered_labels(holdout[TARGET], pred)
    return _evaluate(holdout[TARGET], pred, holdout["kategori_ispu"], labels)


@dataclass
class ClassificationResult:
    algorithm: str
    eval_model: BaseEstimator  # dilatih <= cutoff, untuk perbandingan champion/challenger
    serve_model: BaseEstimator  # dilatih ulang pada semua data
    metrics: dict
    params: dict = field(default_factory=dict)

    @property
    def primary(self) -> float:
        return self.metrics["holdout"][self.algorithm][PRIMARY_METRIC]


def _simple_params(est: BaseEstimator) -> dict:
    return {
        k: v
        for k, v in est.get_params().items()
        if isinstance(v, str | int | float | bool | type(None))
    }


def train_classification(
    df: pd.DataFrame, cutoff: pd.Timestamp, seed: int = 42
) -> ClassificationResult:
    train = df[df["tanggal"] <= cutoff]
    holdout = df[df["tanggal"] > cutoff]
    labels = ordered_labels(df[TARGET])
    models = candidates(seed)

    # Split stratified 80:20 seperti di Orange, hanya untuk pelaporan/paritas.
    # Kelas dengan <2 baris (mis. 1 hari SANGAT TIDAK SEHAT) tidak bisa distratifikasi;
    # untuk stratifikasi saja kelas itu digabung ke kelas terbanyak, labelnya tidak diubah.
    counts = df[TARGET].value_counts()
    strata = df[TARGET].where(df[TARGET].map(counts) >= 2, counts.idxmax())
    s_train, s_test = train_test_split(df, test_size=0.2, stratify=strata, random_state=seed)

    holdout_metrics: dict[str, dict] = {}
    stratified_metrics: dict[str, dict] = {}
    fitted: dict[str, BaseEstimator] = {}
    for name, est in models.items():
        fitted[name] = clone(est).fit(train[FEATURES], train[TARGET])
        holdout_metrics[name] = _evaluate(
            holdout[TARGET],
            fitted[name].predict(holdout[FEATURES]),
            holdout["kategori_ispu"],
            labels,
        )
        strat = clone(est).fit(s_train[FEATURES], s_train[TARGET])
        stratified_metrics[name] = _evaluate(
            s_test[TARGET], strat.predict(s_test[FEATURES]), s_test["kategori_ispu"], labels
        )
    holdout_metrics["rule_baseline"] = _evaluate(
        holdout[TARGET], rule_predict(holdout), holdout["kategori_ispu"], labels
    )
    stratified_metrics["rule_baseline"] = _evaluate(
        s_test[TARGET], rule_predict(s_test), s_test["kategori_ispu"], labels
    )

    best = max(
        models,
        key=lambda n: (holdout_metrics[n][PRIMARY_METRIC], holdout_metrics[n]["accuracy"]),
    )
    rule = holdout_metrics["rule_baseline"]
    metrics = {
        "primary_metric": PRIMARY_METRIC,
        "holdout": holdout_metrics,
        "stratified_80_20": stratified_metrics,
        "beats_rule_baseline": holdout_metrics[best][PRIMARY_METRIC] > rule[PRIMARY_METRIC],
        "n_train": len(train),
        "n_holdout": len(holdout),
        "n_stratified_test": len(s_test),
    }
    return ClassificationResult(
        algorithm=best,
        eval_model=fitted[best],
        serve_model=clone(models[best]).fit(df[FEATURES], df[TARGET]),
        metrics=metrics,
        params=_simple_params(models[best]),
    )
