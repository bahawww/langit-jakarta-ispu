"""Auth admin + upload/retrain/rollback lewat API."""

import asyncio

import pytest
from fastapi.testclient import TestClient

from app import auth
from app.api import admin_routes
from app.main import app

CREDS = {"username": "admin-test", "password": "rahasia-tes-123"}


@pytest.fixture(autouse=True)
def _reset_rate_limit():
    auth._attempts.clear()


@pytest.fixture
def queued(monkeypatch):
    calls = []
    monkeypatch.setattr(
        admin_routes,
        "_enqueue",
        lambda trigger, upload_id=None: calls.append((trigger, upload_id)) or "task-1",
    )
    return calls


@pytest.fixture
def admin(fresh_db) -> TestClient:
    c = TestClient(app)
    assert c.post("/api/auth/login", json=CREDS).status_code == 200
    return c


def test_login_sets_httponly_cookie_and_me():
    c = TestClient(app)
    r = c.post("/api/auth/login", json=CREDS)
    assert r.status_code == 200
    cookie = r.headers["set-cookie"].lower()
    assert "httponly" in cookie and "samesite=strict" in cookie and "path=/api" in cookie
    assert c.get("/api/auth/me").json() == {"username": "admin-test"}
    assert c.post("/api/auth/logout").status_code == 204
    assert c.get("/api/auth/me").status_code == 401


def test_wrong_password_and_rate_limit():
    c = TestClient(app)
    for _ in range(auth.LOGIN_LIMIT):
        assert c.post("/api/auth/login", json={**CREDS, "password": "salah"}).status_code == 401
    r = c.post("/api/auth/login", json=CREDS)  # kredensial benar pun ditolak saat terkunci
    assert r.status_code == 429 and "Retry-After" in r.headers


def test_forged_or_missing_token_rejected():
    c = TestClient(app)
    assert c.post("/api/admin/train").status_code == 401
    c.cookies.set("ispu_session", "bukan.jwt.valid", path="/api")
    assert c.get("/api/auth/me").status_code == 401


def test_cross_origin_write_blocked(admin, queued):
    r = admin.post("/api/admin/train", headers={"Origin": "https://jahat.example"})
    assert r.status_code == 403
    assert queued == []


def test_upload_validation(admin, queued):
    def up(name, body, ctype="text/csv"):
        return admin.post("/api/admin/uploads", files={"file": (name, body, ctype)})

    assert up("data.xlsx", b"a,b\n1,2\n").status_code == 415
    assert up("data.csv", b"a,b\n", "image/png").status_code == 415
    assert up("data.csv", b"   \n").status_code == 400
    big = b"x" * (5 * 1024 * 1024 + 1)
    assert up("data.csv", big).status_code == 413
    bad = up("data.csv", b"foo,bar\n1,2\n")
    assert bad.status_code == 201 and bad.json()["status"] == "failed"
    assert queued == []  # upload gagal tidak memicu retraining


def test_upload_raw_csv_report_and_retrain(admin, queued, seed_dir):
    data = (seed_dir / "raw.csv").read_bytes()
    r = admin.post("/api/admin/uploads", files={"file": ("raw.csv", data, "text/csv")})
    assert r.status_code == 201
    u = r.json()
    assert (u["inserted"], u["updated"], u["unchanged"], u["rejected"]) == (1, 0, 3131, 369)
    assert u["retrain_queued"] is True
    assert queued == [("ingest", u["id"])]

    detail = admin.get(f"/api/admin/uploads/{u['id']}").json()
    assert len(detail["rejected_details"]) == 369
    assert {"line", "reason"} <= set(detail["rejected_details"][0])
    assert admin.get("/api/admin/uploads").json()[0]["id"] == u["id"]

    # Upload ulang tanpa perubahan -> tidak ada retraining.
    again = admin.post("/api/admin/uploads", files={"file": ("raw.csv", data, "text/csv")}).json()
    assert again["retrain_queued"] is None and len(queued) == 1


def test_manual_train_and_rollback_errors(admin, queued):
    assert admin.post("/api/admin/train").status_code == 202
    assert queued == [("manual", None)]
    assert admin.post("/api/admin/models/9999/rollback").status_code == 404


def test_check_config_requires_secrets(monkeypatch):
    from app.config import get_settings

    monkeypatch.setattr(get_settings(), "admin_password", "")
    with pytest.raises(RuntimeError, match="ADMIN_PASSWORD"):
        auth.check_config()


def test_upload_ingest_runs_off_the_event_loop(admin, queued, monkeypatch):
    """Regresi: ingest sinkron di event loop membuat pool koneksi habis saat ada beban paralel."""
    seen: dict[str, bool] = {}
    real = admin_routes.ingest_csv

    def spy(*args, **kwargs):
        try:
            asyncio.get_running_loop()
            seen["on_loop"] = True
        except RuntimeError:
            seen["on_loop"] = False
        return real(*args, **kwargs)

    monkeypatch.setattr(admin_routes, "ingest_csv", spy)
    r = admin.post("/api/admin/uploads", files={"file": ("x.csv", b"foo,bar\n1,2\n", "text/csv")})
    assert r.status_code == 201
    assert seen == {"on_loop": False}
