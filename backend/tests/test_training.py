"""Registry, champion/challenger, skip data sama, rollback, dan API forecast."""

from dataclasses import replace

import pytest
from fastapi.testclient import TestClient
from ispu_ml.forecasting import ForecastConfig
from sqlalchemy import select

from app.db import session_factory
from app.ingest.service import ingest_csv
from app.main import app
from app.models import ModelVersion
from app.training import TrainConfig, rollback, run_training

FAST = TrainConfig(forecast=ForecastConfig(n_estimators=40, backtest_folds=2))
# Model forecast yang sengaja jelek: 1 pohon -> MAE lebih buruk dari champion.
WEAK = replace(FAST, forecast=replace(FAST.forecast, n_estimators=1))


def _versions(task: str) -> list[ModelVersion]:
    with session_factory()() as s:
        return list(
            s.scalars(
                select(ModelVersion).where(ModelVersion.task == task).order_by(ModelVersion.version)
            )
        )


@pytest.mark.usefixtures("fresh_db")
def test_champion_challenger_lifecycle(seed_dir):
    factory = session_factory()

    first = run_training(factory, trigger="initial", cfg=FAST)
    assert first.status == "success", first.message
    for task in ("classification", "forecast"):
        assert first.details[task]["decision"] == "promoted"
        assert first.details[task]["reason"] == "belum ada champion"
    assert first.details["forecasts"] == 35

    # Data dan konfigurasi sama -> dilewati, tidak ada versi baru.
    same = run_training(factory, trigger="schedule", cfg=FAST)
    assert same.status == "skipped"
    assert len(_versions("forecast")) == 1

    # Challenger lebih buruk -> ditolak, champion lama tetap dipakai, alasan dicatat.
    weak = run_training(factory, trigger="manual", cfg=WEAK)
    fc = weak.details["forecast"]
    assert fc["decision"] == "rejected", fc
    assert "champion tetap dipakai" in fc["reason"]
    assert fc["challenger"] > fc["champion"]
    v = _versions("forecast")
    assert [m.status for m in v] == ["champion", "rejected"]

    # Data baru via ingest -> retraining dengan konfigurasi normal, champion dibandingkan ulang.
    with factory() as s:
        u = ingest_csv(s, (seed_dir / "raw.csv").read_bytes(), "raw.csv", source="admin")
    assert u.inserted == 1
    after = run_training(factory, trigger="ingest", upload_id=u.id, cfg=FAST)
    assert after.status == "success"
    assert after.details["forecast"]["decision"] in {"promoted", "rejected"}
    assert after.details["forecast"]["champion_version"] == 1

    # Rollback satu langkah ke v1 (atau tetap valid bila v1 masih champion).
    v1 = _versions("forecast")[0]
    if v1.status != "champion":
        rb = rollback(factory, v1.id)
        assert rb.details["forecast"]["to_version"] == 1
        assert [m.status for m in _versions("forecast")][0] == "champion"
    with pytest.raises(ValueError, match="sudah champion"):
        rollback(factory, v1.id)

    champions = [m for m in _versions("forecast") if m.status == "champion"]
    assert len(champions) == 1

    client = TestClient(app)
    f = client.get("/api/forecast").json()
    assert f["model_version_id"] == champions[0].id
    assert len(f["items"]) == 35
    assert f["interval"] == [0.1, 0.9]
    dki1 = client.get("/api/forecast", params={"station": "DKI1"}).json()["items"]
    assert [i["horizon"] for i in dki1] == list(range(1, 8))
    assert all(i["alert"] == (i["kategori"] != "BAIK" and i["kategori"] != "SEDANG") for i in dki1)

    champs = client.get("/api/models/champions").json()
    assert (
        champs["classification"]["metrics"]["holdout"]["rule_baseline"]["vs_ispu"]["accuracy"] == 1
    )
    runs = client.get("/api/training-runs").json()
    assert [r["trigger"] for r in runs][-4:] == ["ingest", "manual", "schedule", "initial"]
    models = client.get("/api/models", params={"task": "forecast"}).json()
    assert all(m["metrics"] is None for m in models)  # daftar ringkas, detail via /models/{id}
    assert client.get(f"/api/models/{models[0]['id']}").json()["metrics"]["comparison"]


@pytest.mark.usefixtures("fresh_db")
def test_too_little_data_fails_with_reason():
    from sqlalchemy import text

    from app.db import get_engine

    with get_engine().begin() as c:
        c.execute(text("DELETE FROM measurements WHERE tanggal > '2024-01-20'"))
    run = run_training(session_factory(), trigger="manual", cfg=FAST)
    assert run.status == "failed"
    assert "data terlalu sedikit" in run.message
