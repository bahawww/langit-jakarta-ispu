from datetime import date

from sqlalchemy import func, select

from app.db import session_factory
from app.ingest.service import ingest_csv
from app.models import Measurement, Upload


def _count(session) -> int:
    return session.scalar(select(func.count()).select_from(Measurement))


def test_raw_upload_upserts_without_duplicates(fresh_db, seed_dir):
    data = (seed_dir / "raw.csv").read_bytes()
    with session_factory()() as s:
        assert _count(s) == 3131
        u = ingest_csv(s, data, "raw.csv", source="admin")
        assert (u.status, u.format, u.total_rows) == ("success", "raw", 3501)
        # Satu-satunya baris baru: SANGAT TIDAK SEHAT 2024-02-14 DKI3 yang dibuang cleaning lama.
        assert (u.inserted, u.updated, u.unchanged, u.rejected) == (1, 0, 3131, 369)
        assert len(u.rejected_details) == 369
        assert _count(s) == 3132

        again = ingest_csv(s, data, "raw.csv", source="admin")
        assert (again.inserted, again.updated, again.unchanged) == (0, 0, 3132)
        assert _count(s) == 3132


def test_changed_value_counts_as_update(fresh_db):
    header = (
        b"tanggal_lengkap,stasiun,pm_sepuluh,pm_duakomalima,sulfur_dioksida,"
        b"karbon_monoksida,ozon,nitrogen_dioksida,max,kategori\n"
    )
    with session_factory()() as s:
        u = ingest_csv(
            s,
            header + b"2024-01-01,DKI1,64,120,52,9,13,30,120,TIDAK SEHAT\n",
            "fix.csv",
            source="admin",
        )
        assert (u.inserted, u.updated) == (0, 1)
        m = s.scalars(
            select(Measurement).where(
                Measurement.tanggal == date(2024, 1, 1), Measurement.station_id == 1
            )
        ).one()
        assert (m.pm_duakomalima, m.kategori_ispu, m.upload_id) == (120, "TIDAK SEHAT", u.id)


def test_bad_schema_recorded_as_failed_upload(fresh_db):
    with session_factory()() as s:
        u = ingest_csv(s, b"foo,bar\n1,2\n", "bad.csv", source="admin")
        assert u.status == "failed" and "kolom wajib" in u.error
        assert (
            s.scalar(select(func.count()).select_from(Upload).where(Upload.status == "failed")) == 1
        )
