from app.db import session_factory
from app.sync import sync


def test_sync_ingests_once_per_content(fresh_db, seed_dir):
    data = (seed_dir / "raw.csv").read_bytes()  # identik dengan ekspor portal per 2026-10-26
    with session_factory()() as s:
        first = sync(s, data)
        assert first is not None and first.source == "satudata"
        assert (first.inserted, first.rejected) == (1, 369)
        assert sync(s, data) is None  # isi sama -> dilewati
        changed = sync(s, data + b"\n")
        assert changed is not None and changed.inserted == 0
