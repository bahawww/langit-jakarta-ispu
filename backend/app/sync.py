"""Sinkronisasi terjadwal dari ekspor CSV resmi Satu Data Jakarta."""

import hashlib
import logging
import urllib.request

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.ingest.service import ingest_csv
from app.models import Upload

log = logging.getLogger(__name__)
MAX_BYTES = 20 * 1024 * 1024


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "ispu-dashboard/1.0"})
    with urllib.request.urlopen(req, timeout=60) as res:  # noqa: S310 (URL dari konfigurasi)
        data = res.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise ValueError(f"file dari portal melebihi {MAX_BYTES} byte")
    return data


def sync(session: Session, data: bytes | None = None) -> Upload | None:
    """Ingest file portal bila isinya berbeda dari sinkronisasi sebelumnya; None = dilewati."""
    data = fetch(get_settings().satudata_url) if data is None else data
    digest = hashlib.sha256(data).hexdigest()[:16]
    filename = f"satudata-{digest}.csv"
    if session.scalar(
        select(Upload.id).where(Upload.filename == filename, Upload.status == "success")
    ):
        log.info("satudata tidak berubah", extra={"digest": digest})
        return None
    upload = ingest_csv(session, data, filename, source="satudata")
    log.info("satudata di-ingest", extra={"upload_id": upload.id, "inserted": upload.inserted})
    return upload
