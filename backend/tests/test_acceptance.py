"""Acceptance tahap 2: angka acuan dari PROMPT §1 harus keluar dari API, bukan dari CSV."""

import pytest


def test_seed_counts(seeded_client):
    meta = seeded_client.get("/api/meta").json()
    assert meta["total_rows"] == 3131
    assert [s["code"] for s in meta["stations"]] == ["DKI1", "DKI2", "DKI3", "DKI4", "DKI5"]
    assert meta["years"] == [2024, 2025]
    assert (meta["date_min"], meta["date_max"]) == ("2024-01-01", "2025-11-30")
    assert meta["categories"] == ["BAIK", "SEDANG", "TIDAK SEHAT"]

    s = seeded_client.get("/api/stats/summary").json()
    assert s["rows"] == 3131
    assert s["label_inconsistent"] == 21
    assert s["by_kategori"] == {"BAIK": 361, "SEDANG": 2451, "TIDAK SEHAT": 319}
    assert seeded_client.get("/api/stats/summary", params={"year": 2024}).json()["rows"] == 1679
    assert seeded_client.get("/api/stats/summary", params={"year": 2025}).json()["rows"] == 1452


def test_inconsistent_rows_flagged_not_deleted(seeded_client):
    page = seeded_client.get(
        "/api/measurements", params={"inconsistent": True, "page_size": 100}
    ).json()
    assert page["total"] == 21
    assert {i["station_code"] for i in page["items"]} == {"DKI1"}
    assert all(i["kategori"] != i["kategori_ispu"] for i in page["items"])


EXPECTED = {
    # model: (benar, akurasi, weighted F1)
    "Random Forest": (611, 0.9760, 0.9761),
    "Decision Tree": (615, 0.9824, 0.9825),
    "kNN": (575, 0.9185, 0.9155),
}


def test_orange_baseline_reproduced(seeded_client):
    b = seeded_client.get("/api/baseline/orange").json()
    assert b["rows"] == 626
    assert b["labels"] == ["BAIK", "SEDANG", "TIDAK SEHAT"]
    assert round(b["avg_pm_duakomalima"], 2) == 71.64
    assert round(b["avg_pm_sepuluh"], 2) == 48.80
    models = {m["model"]: m for m in b["models"]}
    for name, (correct, acc, f1) in EXPECTED.items():
        m = models[name]
        assert m["correct"] == correct
        assert m["accuracy"] == pytest.approx(acc, abs=5e-5)
        assert m["weighted"]["f1"] == pytest.approx(f1, abs=5e-5)
    assert models["Random Forest"]["confusion_matrix"] == [[68, 4, 0], [6, 483, 1], [0, 4, 60]]
    # Panduan §5: akurasi terhadap kategori turunan ambang ISPU
    assert [models[n]["correct_vs_ispu"] for n in EXPECTED] == [612, 618, 574]


def test_measurements_paging_sort_search(seeded_client):
    page = seeded_client.get(
        "/api/measurements",
        params={"station": "DKI5", "sort": "max", "order": "desc", "page_size": 5},
    ).json()
    assert len(page["items"]) == 5
    maxes = [i["max"] for i in page["items"]]
    assert maxes == sorted(maxes, reverse=True)
    assert seeded_client.get("/api/measurements", params={"q": "kebon"}).json()["total"] == 598
    assert seeded_client.get("/api/measurements", params={"page_size": 501}).status_code == 422
    assert seeded_client.get("/api/measurements", params={"sort": "drop"}).status_code == 422


def test_csv_export(seeded_client):
    r = seeded_client.get("/api/measurements.csv", params={"inconsistent": True})
    assert r.status_code == 200
    lines = r.text.strip().splitlines()
    assert lines[0].startswith("tanggal,station_code")
    assert len(lines) == 22
