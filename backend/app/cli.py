"""Operasi admin dari terminal: python -m app.cli {train|rollback ID|ingest FILE}."""

import argparse
import json
from pathlib import Path

from app.db import session_factory
from app.ingest.service import ingest_csv
from app.logging_setup import setup_logging
from app.training import rollback, run_training


def main() -> None:
    setup_logging()
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("train", help="latih ulang sekarang (sinkron)")
    sub.add_parser("analyze", help="hitung ulang analisis model (sinkron)")
    rb = sub.add_parser("rollback", help="jadikan model_version ID champion")
    rb.add_argument("version_id", type=int)
    ing = sub.add_parser("ingest", help="ingest CSV lalu antrekan retraining")
    ing.add_argument("file", type=Path)
    args = parser.parse_args()

    factory = session_factory()
    if args.cmd == "train":
        run = run_training(factory, trigger="manual")
        out = {"run_id": run.id, "status": run.status, "message": run.message}
    elif args.cmd == "analyze":
        from app.worker import analyze_models

        out = analyze_models()
    elif args.cmd == "rollback":
        run = rollback(factory, args.version_id)
        out = {"run_id": run.id, "message": run.message}
    else:
        from app.worker import enqueue_after_ingest

        with factory() as s:
            u = ingest_csv(s, args.file.read_bytes(), args.file.name, source="admin")
            out = {
                "upload_id": u.id,
                "status": u.status,
                "inserted": u.inserted,
                "updated": u.updated,
                "rejected": u.rejected,
                "retrain_queued": enqueue_after_ingest(u),
            }
    print(json.dumps(out, ensure_ascii=False, default=str))


if __name__ == "__main__":
    main()
