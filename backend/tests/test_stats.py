"""Agregat dashboard: dicek silang dengan fakta data di PROMPT §1."""


def test_daily_series_and_worst_category(seeded_client):
    d = seeded_client.get("/api/stats/daily").json()
    assert len(d) == 700
    assert d[0]["tanggal"] == "2024-01-01"
    assert all(p["max"] >= p["avg"] for p in d)
    one = seeded_client.get("/api/stats/daily", params={"station": "DKI4"}).json()
    assert all(p["stations"] == 1 for p in one)
    assert seeded_client.get("/api/stats/daily", params={"pollutant": "x"}).status_code == 422


def test_monthly_counts_sum_to_total(seeded_client):
    m = seeded_client.get("/api/stats/monthly").json()
    assert len(m) == 23  # Jan 2024 .. Nov 2025
    assert sum(sum(x["counts"].values()) for x in m) == 3131
    by = {x["bulan"]: x["counts"] for x in m}
    # puncak TIDAK SEHAT 2025: Mei 27, Jun 57, Jul 38 (Panduan §4)
    assert [by[b].get("TIDAK SEHAT", 0) for b in ("2025-05", "2025-06", "2025-07")] == [27, 57, 38]


def test_station_stats(seeded_client):
    s = {x["code"]: x for x in seeded_client.get("/api/stats/stations").json()}
    assert s["DKI5"]["by_kategori"]["TIDAK SEHAT"] == 105  # Kebon Jeruk terbanyak
    assert s["DKI4"]["by_kategori"]["TIDAK SEHAT"] == 79  # Lubang Buaya
    assert sum(x["rows"] for x in s.values()) == 3131
    assert next(iter(s["DKI5"]["kritis"])) == "PM25"
    # indeks tertinggi harian tidak pernah di bawah PM2.5, dan tetap dalam skala ISPU
    assert all(x["avg_pm_duakomalima"] <= x["avg_max"] <= 300 for x in s.values())


def test_latest_per_station(seeded_client):
    rows = seeded_client.get("/api/stats/latest").json()
    assert [r["station_code"] for r in rows] == ["DKI1", "DKI2", "DKI3", "DKI4", "DKI5"]
    meta = {s["code"]: s["last_date"] for s in seeded_client.get("/api/meta").json()["stations"]}
    assert all(r["tanggal"] == meta[r["station_code"]] for r in rows)
