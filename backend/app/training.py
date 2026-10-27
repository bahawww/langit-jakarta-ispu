"""Orkestrasi training: snapshot data -> latih -> champion/challenger -> registry."""

import gzip
import json
import logging
import math
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path

import joblib
import pandas as pd
from ispu_ml import ML_VERSION
from ispu_ml.classification import PRIMARY_METRIC as CLS_METRIC
from ispu_ml.classification import score as cls_score
from ispu_ml.classification import train_classification
from ispu_ml.data import holdout_cutoff, normalize_frame, snapshot_bytes, snapshot_hash
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session, sessionmaker

from app import analysis
from app.config import get_settings
from app.ispu import POLLUTANTS
from app.models import Measurement, ModelVersion, Station, TrainingRun

log = logging.getLogger(__name__)

_LOCK_KEY = 4_204_001  # pg advisory lock: cegah dua training berjalan bersamaan
MIN_DAYS = 60
TASKS = ("classification",)


@dataclass
class TrainConfig:
    seed: int = 42

    def as_dict(self) -> dict:
        return asdict(self)


def load_frame(session: Session) -> pd.DataFrame:
    stmt = select(
        Measurement.tanggal,
        Station.code.label("station"),
        *(getattr(Measurement, p) for p in POLLUTANTS),
        Measurement.max,
        Measurement.kategori,
        Measurement.kategori_ispu,
    ).join(Station, Station.id == Measurement.station_id)
    df = pd.DataFrame(session.execute(stmt).all())
    if df.empty:
        return df
    return normalize_frame(df)


def _write_snapshot(df: pd.DataFrame, digest: str) -> Path:
    path = get_settings().artifacts_dir / "snapshots" / f"{digest}.csv.gz"
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(".tmp")
        tmp.write_bytes(gzip.compress(snapshot_bytes(df), mtime=0))
        tmp.rename(path)
    return path


def _jsonable(obj):
    """NaN/inf tidak valid di JSON(B); ganti dengan None."""
    return json.loads(
        json.dumps(obj, default=str),
        parse_constant=lambda _: None,
    )


def _better_or_equal(challenger: float, champion: float) -> bool:
    if math.isnan(challenger):
        return False
    if math.isnan(champion):
        return True
    return challenger >= champion  # macro F1: besar lebih baik


def champion(session: Session, task: str) -> ModelVersion | None:
    return session.scalars(
        select(ModelVersion).where(ModelVersion.task == task, ModelVersion.status == "champion")
    ).one_or_none()


# Keamanan: joblib = pickle. Artifact hanya ditulis oleh proses training ini ke volume privat
# /artifacts (tidak di-mount ke Caddy/web, tidak ada endpoint upload model), jadi aman di-load.
def _artifact_dir(task: str, version: int) -> Path:
    return get_settings().artifacts_dir / task / f"v{version}"


def _train_task(
    session: Session,
    run: TrainingRun,
    task: str,
    df: pd.DataFrame,
    cutoff: pd.Timestamp,
    digest: str,
    cfg: TrainConfig,
) -> dict:
    current = champion(session, task)
    params = {"ml_version": ML_VERSION, "config": cfg.as_dict()}
    if (
        current
        and current.snapshot_hash == digest
        and current.params.get("ml_version") == ML_VERSION
        and current.params.get("config") == _jsonable(params["config"])
    ):
        return {"decision": "skipped", "reason": "data dan konfigurasi sama dengan champion"}

    holdout = df[df["tanggal"] > cutoff]
    result = train_classification(df, cutoff, seed=cfg.seed)
    algorithm, metric_name = result.algorithm, CLS_METRIC
    challenger_value = result.primary
    params["model"] = result.params
    eval_obj, serve_obj = result.eval_model, result.serve_model
    metrics = result.metrics

    champion_value = float("nan")
    if current:
        champ_eval = joblib.load(Path(current.artifact_dir) / "eval.joblib")
        champion_value = cls_score(champ_eval, holdout)[CLS_METRIC]
    promote = current is None or _better_or_equal(challenger_value, champion_value)

    version = (
        session.scalar(select(func.max(ModelVersion.version)).where(ModelVersion.task == task)) or 0
    ) + 1
    adir = _artifact_dir(task, version)
    adir.mkdir(parents=True, exist_ok=True)
    joblib.dump(eval_obj, adir / "eval.joblib")
    joblib.dump(serve_obj, adir / "serve.joblib")

    comparison = {
        "metric": metric_name,
        "challenger": challenger_value,
        "champion": None if current is None else champion_value,
        "champion_version": None if current is None else current.version,
        "holdout_start": (cutoff + pd.Timedelta(days=1)).date().isoformat(),
    }
    if promote and current:
        current.status = "archived"
        session.flush()  # lepas indeks unik champion sebelum champion baru ditulis
    mv = ModelVersion(
        task=task,
        version=version,
        status="champion" if promote else "rejected",
        promoted_at=datetime.now(UTC) if promote else None,
        algorithm=algorithm,
        ml_version=ML_VERSION,
        train_start=df["tanggal"].min().date(),
        train_end=cutoff.date(),
        data_end=df["tanggal"].max().date(),
        n_rows=len(df),
        primary_metric=metric_name,
        primary_value=challenger_value,
        metrics=_jsonable(metrics | {"comparison": comparison}),
        params=_jsonable(params),
        artifact_dir=str(adir),
        snapshot_hash=digest,
        training_run_id=run.id,
    )
    session.add(mv)
    session.flush()
    if current is None:
        reason = "belum ada champion"
    elif promote:
        reason = (
            f"challenger {challenger_value:.4f} >= champion {champion_value:.4f} ({metric_name})"
        )
    else:
        reason = (
            f"challenger {challenger_value:.4f} lebih buruk dari champion v{current.version} "
            f"{champion_value:.4f} ({metric_name}); champion tetap dipakai"
        )
    return _jsonable(
        {
            "decision": "promoted" if promote else "rejected",
            "reason": reason,
            "version": version,
            "model_version_id": mv.id,
            **comparison,
        }
    )


def run_training(
    factory: sessionmaker[Session],
    trigger: str,
    upload_id: int | None = None,
    cfg: TrainConfig | None = None,
) -> TrainingRun:
    cfg = cfg or TrainConfig()
    with factory() as session:
        locked = session.scalar(text("SELECT pg_try_advisory_lock(:k)"), {"k": _LOCK_KEY})
        try:
            return _run_locked(session, trigger, upload_id, cfg, locked)
        finally:
            if locked:
                session.execute(text("SELECT pg_advisory_unlock(:k)"), {"k": _LOCK_KEY})
                session.commit()


def _run_locked(
    session: Session, trigger: str, upload_id: int | None, cfg: TrainConfig, locked: bool
) -> TrainingRun:
    run = TrainingRun(trigger=trigger, status="running", upload_id=upload_id, details={})
    session.add(run)
    session.commit()
    if not locked:
        run.status, run.message = "skipped", "training lain sedang berjalan"
        run.finished_at = datetime.now(UTC)
        session.commit()
        return run
    try:
        df = load_frame(session)
        n_days = df["tanggal"].nunique() if not df.empty else 0
        if n_days < MIN_DAYS:
            raise ValueError(f"data terlalu sedikit untuk training: {n_days} hari (< {MIN_DAYS})")
        digest = snapshot_hash(df)
        _write_snapshot(df, digest)
        cutoff = holdout_cutoff(df["tanggal"])
        run.snapshot_hash = digest
        details = {"cutoff": cutoff.date().isoformat(), "rows": len(df)}
        for task in TASKS:
            details[task] = _train_task(session, run, task, df, cutoff, digest, cfg)
            log.info("training task", extra={"run_id": run.id, "task": task, **details[task]})
        try:
            details["analysis"] = analysis.ensure(df, digest, cfg.seed)
        except Exception:  # analisis pelengkap: kegagalannya tidak boleh menggagalkan training
            log.exception("analisis model gagal", extra={"run_id": run.id})
            details["analysis"] = "failed"
        run.details = details
        decisions = {details[t]["decision"] for t in TASKS}
        run.status = "skipped" if decisions == {"skipped"} else "success"
        run.message = "; ".join(f"{t}: {details[t]['reason']}" for t in TASKS)
    except Exception as e:
        session.rollback()
        run = session.get(TrainingRun, run.id)
        run.status, run.message = "failed", f"{type(e).__name__}: {e}"[:2000]
        log.exception("training gagal", extra={"run_id": run.id})
    run.finished_at = datetime.now(UTC)
    session.commit()
    return run


def rollback(factory: sessionmaker[Session], version_id: int) -> TrainingRun:
    """Jadikan versi lama champion lagi (satu klik di admin)."""
    with factory() as session:
        target = session.get(ModelVersion, version_id)
        if target is None:
            raise LookupError(f"model version {version_id} tidak ada")
        if target.status == "champion":
            raise ValueError(f"v{target.version} sudah champion")
        current = champion(session, target.task)
        if current:
            current.status = "archived"
            session.flush()
        target.status, target.promoted_at = "champion", datetime.now(UTC)
        details = {
            target.task: {
                "decision": "rollback",
                "from_version": current.version if current else None,
                "to_version": target.version,
            }
        }
        run = TrainingRun(
            trigger="rollback",
            status="success",
            details=details,
            message=f"{target.task}: rollback ke v{target.version}",
            finished_at=datetime.now(UTC),
        )
        session.add(run)
        session.commit()
        return run
