"""Tes memakai database terpisah `<db>_test` di server PostgreSQL yang sama."""

import os
import tempfile

from sqlalchemy.engine import make_url

_url = make_url(os.environ["DATABASE_URL"])
_test_url = _url.set(database=f"{_url.database}_test")
os.environ["DATABASE_URL"] = _test_url.render_as_string(hide_password=False)
os.environ["ARTIFACTS_DIR"] = tempfile.mkdtemp(prefix="ispu-artifacts-")
os.environ.update(
    ADMIN_USERNAME="admin-test",
    ADMIN_PASSWORD="rahasia-tes-123",
    JWT_SECRET="x" * 48,
    COOKIE_SECURE="false",  # TestClient memakai http://testserver
)

import pytest  # noqa: E402
from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine, text  # noqa: E402

from app import seed  # noqa: E402
from app.config import get_settings  # noqa: E402
from app.db import get_engine  # noqa: E402
from app.main import app  # noqa: E402

_TABLES = (
    "forecasts, model_versions, training_runs, measurements, orange_baseline, uploads, stations"
)


@pytest.fixture(scope="session", autouse=True)
def _database() -> None:
    admin = create_engine(_url.set(database="postgres"), isolation_level="AUTOCOMMIT")
    with admin.connect() as conn:
        if not conn.scalar(
            text("SELECT 1 FROM pg_database WHERE datname = :n"), {"n": _test_url.database}
        ):
            conn.execute(text(f'CREATE DATABASE "{_test_url.database}"'))
    admin.dispose()
    command.upgrade(Config("alembic.ini"), "head")


@pytest.fixture
def fresh_db() -> None:
    """Kosongkan semua tabel lalu seed ulang dari CSV, seperti start pertama."""
    with get_engine().begin() as conn:
        conn.execute(text(f"TRUNCATE {_TABLES} RESTART IDENTITY CASCADE"))
    seed.run()


@pytest.fixture(scope="module")
def seeded_client() -> TestClient:
    with get_engine().begin() as conn:
        conn.execute(text(f"TRUNCATE {_TABLES} RESTART IDENTITY CASCADE"))
    seed.run()
    return TestClient(app)


@pytest.fixture
def seed_dir():
    return get_settings().seed_dir


@pytest.fixture(scope="session")
def clean_frame():
    """Data bersih sebagai DataFrame model (tanpa DB)."""
    import pandas as pd
    from ispu_ml.data import normalize_frame

    from app.ingest.parse import parse_csv

    rows = parse_csv((get_settings().seed_dir / "clean.csv").read_bytes()).rows
    return normalize_frame(
        pd.DataFrame(
            [
                {
                    "tanggal": r.tanggal,
                    "station": r.station_code,
                    **r.values,
                    "max": r.max,
                    "kategori": r.kategori,
                    "kategori_ispu": r.kategori_ispu,
                }
                for r in rows
            ]
        )
    )
