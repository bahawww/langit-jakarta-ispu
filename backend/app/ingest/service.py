"""Tulis hasil parse ke database: upsert per (tanggal, stasiun) + laporan upload."""

import logging

from sqlalchemy import func, literal_column, or_, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.ingest.parse import ParsedRow, SchemaError, parse_csv
from app.ispu import POLLUTANTS
from app.models import Measurement, OrangeBaseline, Station, Upload

log = logging.getLogger(__name__)

_CHUNK = 1000  # 1000 baris x ~14 kolom, aman di bawah batas 65.535 parameter PostgreSQL
_MAX_REJECT_DETAILS = 1000
_VALUE_COLUMNS = (
    *POLLUTANTS,
    "max",
    "parameter_pencemar_kritis",
    "kategori",
    "kategori_ispu",
    "label_inconsistent",
)


def ensure_stations(session: Session, rows: list[ParsedRow]) -> dict[str, int]:
    """Buat stasiun baru (kode DKIn) jika belum ada; nama stasiun lama tidak ditimpa."""
    names: dict[str, str] = {}
    for r in rows:
        names.setdefault(r.station_code, r.station_name)
    if names:
        session.execute(
            insert(Station)
            .values([{"code": c, "name": n} for c, n in names.items()])
            .on_conflict_do_nothing(index_elements=["code"])
        )
    return dict(session.execute(select(Station.code, Station.id)).all())


def _record(r: ParsedRow, station_id: int) -> dict[str, object]:
    return {
        "tanggal": r.tanggal,
        "station_id": station_id,
        **r.values,
        "max": r.max,
        "parameter_pencemar_kritis": r.parameter_pencemar_kritis,
        "kategori": r.kategori,
        "kategori_ispu": r.kategori_ispu,
        "label_inconsistent": r.label_inconsistent,
    }


def upsert_measurements(
    session: Session, rows: list[ParsedRow], upload_id: int | None
) -> tuple[int, int]:
    """Kembalikan (inserted, updated). Baris identik tidak di-update."""
    station_ids = ensure_stations(session, rows)
    table = Measurement.__table__
    inserted = updated = 0
    for start in range(0, len(rows), _CHUNK):
        chunk = [
            {**_record(r, station_ids[r.station_code]), "upload_id": upload_id}
            for r in rows[start : start + _CHUNK]
        ]
        stmt = insert(table).values(chunk)
        stmt = stmt.on_conflict_do_update(
            index_elements=["tanggal", "station_id"],
            set_={c: stmt.excluded[c] for c in (*_VALUE_COLUMNS, "upload_id")}
            | {"updated_at": func.now()},
            where=or_(*(table.c[c].is_distinct_from(stmt.excluded[c]) for c in _VALUE_COLUMNS)),
        ).returning(literal_column("xmax = 0"))
        flags = session.execute(stmt).scalars().all()
        inserted += sum(flags)
        updated += len(flags) - sum(flags)
    return inserted, updated


def ingest_csv(session: Session, data: bytes, filename: str, source: str) -> Upload:
    """Validasi -> normalisasi -> upsert. Selalu menyimpan laporan Upload (juga saat gagal)."""
    upload = Upload(filename=filename, source=source, status="processing")
    session.add(upload)
    session.flush()
    try:
        result = parse_csv(data)
        inserted, updated = upsert_measurements(session, result.rows, upload.id)
    except (SchemaError, UnicodeDecodeError) as e:
        session.rollback()
        upload = Upload(filename=filename, source=source, status="failed", error=str(e)[:1000])
        session.add(upload)
        session.commit()
        log.warning("ingest gagal", extra={"upload_file": filename, "error": str(e)})
        return upload

    upload.format = result.format
    upload.total_rows = result.total
    upload.inserted = inserted
    upload.updated = updated
    upload.unchanged = len(result.rows) - inserted - updated
    upload.rejected = len(result.rejected)
    upload.rejected_details = result.rejected[:_MAX_REJECT_DETAILS]
    upload.status = "success"
    session.commit()
    log.info(
        "ingest selesai",
        extra={
            "upload_id": upload.id,
            "upload_file": filename,
            "inserted": inserted,
            "updated": updated,
            "rejected": upload.rejected,
        },
    )
    return upload


def load_orange_baseline(session: Session, data: bytes) -> int:
    """Simpan data uji + prediksi Orange (RF, DT, kNN) sebagai baseline pembanding."""
    result = parse_csv(data)
    if result.rejected:
        raise ValueError(f"baseline Orange punya baris tidak valid: {result.rejected[:3]}")
    station_ids = ensure_stations(session, result.rows)
    records = [
        {
            **_record(r, station_ids[r.station_code]),
            "pred_random_forest": r.raw["prediksi_random_forest"].strip(),
            "pred_decision_tree": r.raw["prediksi_decision_tree"].strip(),
            "pred_knn": r.raw["prediksi_knn"].strip(),
        }
        for r in result.rows
    ]
    for rec in records:
        rec.pop("label_inconsistent")
    session.execute(insert(OrangeBaseline).values(records).on_conflict_do_nothing())
    session.commit()
    return len(records)
