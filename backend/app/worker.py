"""Celery: retraining setelah ingest, jadwal mingguan cadangan, training awal."""

import logging

from celery import Celery
from celery.schedules import crontab
from celery.signals import worker_ready

from app.config import get_settings
from app.db import session_factory
from app.logging_setup import setup_logging
from app.models import Upload
from app.training import champion, run_training

setup_logging()
log = logging.getLogger(__name__)

celery = Celery("ispu", broker=get_settings().redis_url)
celery.conf.update(
    timezone="Asia/Jakarta",
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    worker_hijack_root_logger=False,
    broker_connection_timeout=3,
    beat_schedule={
        "retrain-mingguan": {
            "task": "ispu.train",
            "schedule": crontab(hour=2, minute=0, day_of_week="sunday"),
            "kwargs": {"trigger": "schedule"},
        },
        "sync-satudata-harian": {
            "task": "ispu.sync_satudata",
            "schedule": crontab(hour=3, minute=0),
        },
    },
)


@celery.task(name="ispu.train")
def train(trigger: str = "manual", upload_id: int | None = None) -> dict:
    run = run_training(session_factory(), trigger=trigger, upload_id=upload_id)
    return {"run_id": run.id, "status": run.status, "message": run.message}


@celery.task(name="ispu.sync_satudata")
def sync_satudata() -> dict:
    if not get_settings().satudata_sync:
        return {"status": "disabled"}
    from app.sync import sync

    with session_factory()() as s:
        upload = sync(s)
    if upload is None:
        return {"status": "unchanged"}
    return {
        "status": upload.status,
        "upload_id": upload.id,
        "retrain": enqueue_after_ingest(upload),
    }


def enqueue_after_ingest(upload: Upload) -> bool:
    """Picu retraining hanya jika ingest berhasil dan benar-benar mengubah data."""
    if upload.status == "success" and (upload.inserted or upload.updated):
        train.delay(trigger="ingest", upload_id=upload.id)
        return True
    return False


@worker_ready.connect
def _initial_training(**_) -> None:
    with session_factory()() as s:
        missing = [t for t in ("classification",) if champion(s, t) is None]
    if missing:
        log.info("belum ada champion, training awal dijadwalkan", extra={"tasks": missing})
        train.delay(trigger="initial")
