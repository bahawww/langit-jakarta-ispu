"""Registry, champion/challenger, skip data sama, dan rollback (klasifikasi model dasar)."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

import app.training as training
from app.db import session_factory
from app.ingest.service import ingest_csv
from app.main import app
from app.models import ModelVersion
from app.training import rollback, run_training


def _versions() -> list[ModelVersion]:
    with session_factory()() as s:
        return list(
            s.scalars(
                select(ModelVersion)
                .where(ModelVersion.task == "classification")
                .order_by(ModelVersion.version)
            )
        )


@pytest.mark.usefixtures("fresh_db")
def test_champion_challenger_lifecycle(seed_dir, monkeypatch):
    factory = session_factory()

    first = run_training(factory, trigger="initial")
    assert first.status == "success", first.message
    assert first.details["classification"]["decision"] == "promoted"
    assert first.details["classification"]["reason"] == "belum ada champion"
    assert set(first.details) == {"cutoff", "rows", "classification"}

    # Data dan konfigurasi sama -> dilewati, tidak ada versi baru.
    same = run_training(factory, trigger="schedule")
    assert same.status == "skipped"
    assert len(_versions()) == 1

    # Champion lama dibuat tak terkalahkan -> challenger ditolak, alasan dicatat.
    with monkeypatch.context() as m:
        m.setattr(training, "cls_score", lambda *_: {training.CLS_METRIC: 2.0})
        m.setattr(training, "ML_VERSION", "uji-tolak")
        weak = run_training(factory, trigger="manual")
    cls = weak.details["classification"]
    assert cls["decision"] == "rejected", cls
    assert "champion tetap dipakai" in cls["reason"]
    assert [v.status for v in _versions()] == ["champion", "rejected"]

    # Data baru via ingest -> retraining, champion dibandingkan ulang.
    with factory() as s:
        u = ingest_csv(s, (seed_dir / "raw.csv").read_bytes(), "raw.csv", source="admin")
    assert u.inserted == 1
    after = run_training(factory, trigger="ingest", upload_id=u.id)
    assert after.status == "success"
    assert after.details["classification"]["decision"] in {"promoted", "rejected"}
    assert after.details["classification"]["champion_version"] == 1

    # Rollback ke v1 (atau tetap valid bila v1 masih champion).
    v1 = _versions()[0]
    if v1.status != "champion":
        rb = rollback(factory, v1.id)
        assert rb.details["classification"]["to_version"] == 1
        assert _versions()[0].status == "champion"
    with pytest.raises(ValueError, match="sudah champion"):
        rollback(factory, v1.id)
    assert len([m for m in _versions() if m.status == "champion"]) == 1

    client = TestClient(app)
    champs = client.get("/api/models/champions").json()
    assert set(champs) == {"classification"}
    holdout = champs["classification"]["metrics"]["holdout"]
    assert set(holdout) == {"decision_tree", "random_forest", "knn"}
    assert client.get("/api/forecast").status_code == 404
    runs = client.get("/api/training-runs").json()
    assert [r["trigger"] for r in runs][-4:] == ["ingest", "manual", "schedule", "initial"]
    models = client.get("/api/models").json()
    assert all(m["metrics"] is None for m in models)  # daftar ringkas, detail via /models/{id}
    assert client.get(f"/api/models/{models[0]['id']}").json()["metrics"]["comparison"]


@pytest.mark.usefixtures("fresh_db")
def test_too_little_data_fails_with_reason():
    from sqlalchemy import text

    from app.db import get_engine

    with get_engine().begin() as c:
        c.execute(text("DELETE FROM measurements WHERE tanggal > '2024-01-20'"))
    run = run_training(session_factory(), trigger="manual")
    assert run.status == "failed"
    assert "data terlalu sedikit" in run.message
