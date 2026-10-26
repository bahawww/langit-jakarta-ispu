from collections import Counter
from datetime import date

import pytest

from app.ingest.parse import SchemaError, normalize_station, parse_csv
from app.ispu import kategori_from_index


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        (0, "BAIK"),
        (50, "BAIK"),
        (51, "SEDANG"),
        (100, "SEDANG"),
        (101, "TIDAK SEHAT"),
        (200, "TIDAK SEHAT"),
        (201, "SANGAT TIDAK SEHAT"),
        (300, "SANGAT TIDAK SEHAT"),
        (301, "BERBAHAYA"),
    ],
)
def test_kategori_thresholds(value, expected):
    assert kategori_from_index(value) == expected


@pytest.mark.parametrize(
    "raw",
    [
        "DKI1  Bunderan HI",
        "DKI1 Bundaran Hotel Indonesia  HI",
        "DKI1 - Bundaran HI (Jakarta Pusat)",
    ],
)
def test_station_variants_map_to_one_code(raw):
    assert normalize_station(raw)[0] == "DKI1"


def test_station_without_code_rejected():
    with pytest.raises(ValueError):
        normalize_station("Stasiun Monas")


def test_clean_csv(seed_dir):
    r = parse_csv((seed_dir / "clean.csv").read_bytes())
    assert (r.format, r.total, len(r.rows), len(r.rejected)) == ("clean", 3131, 3131, 0)
    assert Counter(x.kategori for x in r.rows) == {"BAIK": 361, "SEDANG": 2451, "TIDAK SEHAT": 319}
    bad = [x for x in r.rows if x.label_inconsistent]
    assert len(bad) == 21
    assert {(x.station_code, x.tanggal.strftime("%Y%m")) for x in bad} == {("DKI1", "202412")}
    assert sum(x.kategori == "BAIK" for x in bad) == 19
    assert sum(x.parameter_pencemar_kritis is None for x in r.rows) == 41


def test_raw_csv_double_bom_and_na(seed_dir):
    data = (seed_dir / "raw.csv").read_bytes()
    assert data.startswith(b"\xef\xbb\xbf\xef\xbb\xbf")
    r = parse_csv(data)
    assert (r.format, r.total, len(r.rows), len(r.rejected)) == ("raw", 3501, 3132, 369)
    assert {x.station_code for x in r.rows} == {"DKI1", "DKI2", "DKI3", "DKI4", "DKI5"}
    sts = [x for x in r.rows if x.kategori == "SANGAT TIDAK SEHAT"]
    assert [(x.tanggal, x.station_code, x.max) for x in sts] == [(date(2024, 2, 14), "DKI3", 202)]
    assert all(j["reason"] for j in r.rejected)


def test_schema_error():
    with pytest.raises(SchemaError, match="kolom wajib"):
        parse_csv(b"a,b,c\n1,2,3\n")


def test_max_mismatch_and_duplicate_rejected():
    header = (
        b"tanggal_lengkap,stasiun,pm_sepuluh,pm_duakomalima,sulfur_dioksida,"
        b"karbon_monoksida,ozon,nitrogen_dioksida,max,kategori\n"
    )
    body = (
        b"2024-01-01,DKI1,10,20,5,5,5,5,99,BAIK\n"
        b"2024-01-02,DKI1,10,20,5,5,5,5,20,BAIK\n"
        b"2024-01-02,DKI1,10,20,5,5,5,5,20,BAIK\n"
    )
    r = parse_csv(header + body)
    assert len(r.rows) == 1
    assert [j["line"] for j in r.rejected] == [2, 4]
    assert "max" in r.rejected[0]["reason"] and "duplikat" in r.rejected[1]["reason"]
