"""Tes analisis model dasar (Ringkasan, Evaluasi, Penjelasan, Simulator)."""

import pytest
from ispu_ml.analysis import analyze
from ispu_ml.classification import FEATURES


@pytest.fixture(scope="module")
def result(clean_frame):
    return analyze(clean_frame, seed=42)


def test_analysis_covers_three_base_models(result):
    out, serve = result
    names = {"decision_tree", "random_forest", "knn"}
    assert set(serve) == names
    for key in ("importance", "roc", "cv", "learning"):
        assert names <= set(out[key])
    assert out["n_train"] + out["n_test"] == 3131 and out["n_test"] == 627


def test_importance_is_a_share_over_all_features(result):
    out, _ = result
    for imp in out["importance"].values():
        assert set(imp) == set(FEATURES)
        assert abs(sum(imp.values()) - 1) < 1e-2
    # PM2.5 paling menentukan di data ini (porsi penyebab kategori terbesar)
    rf = out["importance"]["random_forest"]
    assert max(rf, key=rf.get) == "pm_duakomalima"


def test_curves_are_well_formed(result):
    out, _ = result
    for roc in out["roc"].values():
        assert 0.5 < roc["auc"] <= 1
        assert roc["fpr"][0] == 0 and roc["fpr"][-1] == 1
        assert roc["tpr"] == sorted(roc["tpr"])
    assert len(out["cv"]["random_forest"]["accuracy"]) == 5
    sizes = out["learning"]["sizes"]
    assert sizes == sorted(sizes) and len(out["learning"]["knn"]["val"]) == len(sizes)


def test_baselines_and_grid_and_tree(result):
    out, _ = result
    assert out["baselines"]["majority"]["label"] == "SEDANG"
    rf_acc = out["cv"]["random_forest"]["accuracy"]
    assert sum(rf_acc) / 5 > out["baselines"]["majority"]["accuracy"]
    g = out["grid"]
    assert len(g["f1"]) == len(g["max_depth"]) and len(g["f1"][0]) == len(g["n_estimators"])
    assert out["tree"]["children"] and out["tree"]["n"] == out["n_train"]
    assert set(out["pdp"]) == set(FEATURES)
    assert set(out["test_accuracy"]) == {"decision_tree", "random_forest", "knn"}
    assert set(out["presets"]) == {"BAIK", "SEDANG", "TIDAK SEHAT"}
    assert (
        out["presets"]["TIDAK SEHAT"]["pm_duakomalima"]
        > 100
        >= out["presets"]["SEDANG"]["pm_duakomalima"]
    )


def test_analysis_endpoint_and_simulator(seeded_client, clean_frame):
    from ispu_ml.data import snapshot_hash

    from app import analysis

    digest = snapshot_hash(clean_frame)
    analysis.ensure(clean_frame, digest)  # bisa sudah dihitung oleh tes training
    assert (
        analysis.ensure(clean_frame, digest) is False
    )  # data dan versi sama: tidak dihitung ulang

    data = seeded_client.get("/api/analysis").json()
    assert data["data_hash"] == digest and data["rows"] == 3131
    assert {"importance", "roc", "pr", "cv", "learning", "depth", "grid", "tree", "pdp"} <= set(
        data
    )

    ok = {"pm_sepuluh": 40, "pm_duakomalima": 72, "sulfur_dioksida": 30, "karbon_monoksida": 10}
    ok |= {"ozon": 25, "nitrogen_dioksida": 20}
    r = seeded_client.post("/api/simulate", json=ok).json()
    assert r["ispu_category"] == "SEDANG"
    assert set(r["models"]) == {"decision_tree", "random_forest", "knn"}
    for m in r["models"].values():
        assert abs(sum(m["probabilities"].values()) - 1) < 1e-2
    assert r["models"]["random_forest"]["label"] == "SEDANG"

    clean = dict.fromkeys(ok, 12)
    low = seeded_client.post("/api/simulate", json=clean).json()
    assert low["ispu_category"] == "BAIK" and low["models"]["random_forest"]["label"] == "BAIK"

    assert seeded_client.post("/api/simulate", json=ok | {"ozon": 501}).status_code == 422
