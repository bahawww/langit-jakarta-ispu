"""Tes pipeline ML tanpa database: holdout waktu, kandidat model dasar, reproducibility."""

import numpy as np
import pytest
from ispu_ml.classification import train_classification
from ispu_ml.data import holdout_cutoff, snapshot_hash
from ispu_ml.ispu import kategori_array


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


@pytest.fixture(scope="module")
def cls_result(clean_frame):
    return train_classification(clean_frame, holdout_cutoff(clean_frame["tanggal"]), seed=42)


def test_classification_trains_all_candidates(cls_result):
    h = cls_result.metrics["holdout"]
    assert set(h) == {"decision_tree", "random_forest", "knn"}
    assert cls_result.algorithm in h
    assert cls_result.metrics["n_holdout"] + cls_result.metrics["n_train"] == 3131
    assert cls_result.metrics["n_stratified_test"] == 627  # 20% dari 3131, dibulatkan ke atas
    for m in h.values():
        assert len(m["confusion_matrix"]) == len(m["labels"])


def test_classification_reproducible(clean_frame, cls_result):
    again = train_classification(clean_frame, holdout_cutoff(clean_frame["tanggal"]), seed=42)
    assert again.algorithm == cls_result.algorithm
    assert again.metrics["holdout"] == cls_result.metrics["holdout"]


def test_classification_handles_single_member_class(clean_frame):
    df = clean_frame.copy()
    i = df.index[0]
    df.loc[i, ["nitrogen_dioksida", "max"]] = 202
    df.loc[i, ["kategori", "kategori_ispu"]] = "SANGAT TIDAK SEHAT"
    r = train_classification(df, holdout_cutoff(df["tanggal"]), seed=42)
    # baris STS ada di tanggal paling awal -> masuk data latih time split, model tetap terlatih
    assert "SANGAT TIDAK SEHAT" in r.eval_model.classes_
    assert r.metrics["n_stratified_test"] == 627
