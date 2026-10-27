"""Klasifikasi kategori ISPU dari 6 polutan di hari yang sama.

Hanya model dasar scikit-learn (Decision Tree, Random Forest, kNN k=5), tanpa tuning.
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

from ispu_ml.ispu import POLLUTANTS
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


def strata_of(df: pd.DataFrame, min_count: int = 2) -> pd.Series:
    """Label untuk stratifikasi.

    Kelas dengan anggota kurang dari `min_count` (mis. 1 hari SANGAT TIDAK SEHAT) tidak bisa
    distratifikasi, jadi digabung ke kelas terbanyak; label aslinya tidak diubah.
    """
    counts = df[TARGET].value_counts()
    return df[TARGET].where(df[TARGET].map(counts) >= min_count, counts.idxmax())


def stratified_split(df: pd.DataFrame, seed: int) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Split stratified 80:20 seperti di Orange (untuk pelaporan/paritas)."""
    return train_test_split(df, test_size=0.2, stratify=strata_of(df), random_state=seed)


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

    s_train, s_test = stratified_split(df, seed)

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

    best = max(
        models,
        key=lambda n: (holdout_metrics[n][PRIMARY_METRIC], holdout_metrics[n]["accuracy"]),
    )
    metrics = {
        "primary_metric": PRIMARY_METRIC,
        "holdout": holdout_metrics,
        "stratified_80_20": stratified_metrics,
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
