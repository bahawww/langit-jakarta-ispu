"""Analisis model dasar: dihitung setelah training, disimpan di artifacts, dibaca API."""

import json
import logging
import os
from datetime import UTC, datetime
from pathlib import Path

import joblib
import pandas as pd
from ispu_ml import ML_VERSION
from ispu_ml.analysis import ANALYSIS_VERSION, analyze

from app.config import get_settings

log = logging.getLogger(__name__)

# Keamanan: joblib = pickle. File hanya ditulis proses ini ke volume privat /artifacts
# (bukan upload pengguna), sama seperti artifact model di training.py.
_cache: dict[str, tuple[float, object]] = {}


def _dir() -> Path:
    return get_settings().artifacts_dir / "analysis"


def _cached(path: Path, loader):
    """Baca file hanya bila berubah (mtime), supaya endpoint murah."""
    if not path.exists():
        return None
    mtime = path.stat().st_mtime
    hit = _cache.get(str(path))
    if hit and hit[0] == mtime:
        return hit[1]
    value = loader(path)
    _cache[str(path)] = (mtime, value)
    return value


def load() -> dict | None:
    return _cached(_dir() / "analysis.json", lambda p: json.loads(p.read_text()))


def models() -> dict | None:
    return _cached(_dir() / "models.joblib", joblib.load)


def is_current(digest: str) -> bool:
    data = load()
    return bool(
        data
        and data.get("data_hash") == digest
        and data.get("analysis_version") == ANALYSIS_VERSION
        and data.get("ml_version") == ML_VERSION
        and (_dir() / "models.joblib").exists()
    )


def ensure(df: pd.DataFrame, digest: str, seed: int = 42) -> bool:
    """Hitung ulang bila data atau versi kode berubah. True kalau benar-benar dihitung."""
    if is_current(digest):
        return False
    result, serve = analyze(df, seed=seed)
    result |= {
        "data_hash": digest,
        "analysis_version": ANALYSIS_VERSION,
        "ml_version": ML_VERSION,
        "created_at": datetime.now(UTC).isoformat(),
        "rows": len(df),
    }
    out = _dir()
    out.mkdir(parents=True, exist_ok=True)
    # tulis ke file sementara lalu ganti, supaya pembaca tidak pernah melihat file setengah jadi
    tmp_m, tmp_j = out / "models.joblib.tmp", out / "analysis.json.tmp"
    joblib.dump(serve, tmp_m)
    tmp_j.write_text(json.dumps(result, ensure_ascii=False))
    os.replace(tmp_m, out / "models.joblib")
    os.replace(tmp_j, out / "analysis.json")
    log.info("analisis model dihitung", extra={"hash": digest[:12], "rows": len(df)})
    return True
