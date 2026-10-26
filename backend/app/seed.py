"""Seed idempoten saat start: data bersih -> measurements, hasil testing Orange -> baseline."""

import logging

from sqlalchemy import exists, select

from app.config import get_settings
from app.db import session_factory
from app.ingest.service import ingest_csv, load_orange_baseline
from app.logging_setup import setup_logging
from app.models import Measurement, OrangeBaseline

log = logging.getLogger("app.seed")

CLEAN_FILE = "clean.csv"
ORANGE_FILE = "orange_test.csv"


def run() -> None:
    seed_dir = get_settings().seed_dir
    with session_factory()() as session:
        if not session.scalar(select(exists().where(Measurement.id.isnot(None)))):
            upload = ingest_csv(
                session, (seed_dir / CLEAN_FILE).read_bytes(), CLEAN_FILE, source="seed"
            )
            if upload.status != "success":
                raise SystemExit(f"seed gagal: {upload.error}")
            log.info("seed measurements", extra={"inserted": upload.inserted})
        if not session.scalar(select(exists().where(OrangeBaseline.id.isnot(None)))):
            n = load_orange_baseline(session, (seed_dir / ORANGE_FILE).read_bytes())
            log.info("seed baseline Orange", extra={"rows": n})


if __name__ == "__main__":
    setup_logging()
    run()
