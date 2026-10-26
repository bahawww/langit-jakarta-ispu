"""Tes memakai database terpisah `<db>_test` di server PostgreSQL yang sama."""

import os

from sqlalchemy.engine import make_url

_url = make_url(os.environ["DATABASE_URL"])
_test_url = _url.set(database=f"{_url.database}_test")
os.environ["DATABASE_URL"] = _test_url.render_as_string(hide_password=False)

import pytest  # noqa: E402
from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine, text  # noqa: E402

from app import seed  # noqa: E402
from app.config import get_settings  # noqa: E402
from app.db import get_engine  # noqa: E402
from app.main import app  # noqa: E402


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
        conn.execute(
            text(
                "TRUNCATE measurements, orange_baseline, uploads, stations RESTART IDENTITY CASCADE"
            )
        )
    seed.run()


@pytest.fixture(scope="module")
def seeded_client() -> TestClient:
    with get_engine().begin() as conn:
        conn.execute(
            text(
                "TRUNCATE measurements, orange_baseline, uploads, stations RESTART IDENTITY CASCADE"
            )
        )
    seed.run()
    return TestClient(app)


@pytest.fixture
def seed_dir():
    return get_settings().seed_dir
