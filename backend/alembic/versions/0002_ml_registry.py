"""training_runs, model_versions, forecasts

Revision ID: 0002
Revises: 0001
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def _now() -> sa.Column:
    return sa.Column(
        "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
    )


def upgrade() -> None:
    op.create_table(
        "training_runs",
        sa.Column("id", sa.Integer(), primary_key=True),
        _now(),
        sa.Column("finished_at", sa.DateTime(timezone=True)),
        sa.Column("trigger", sa.String(16), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("upload_id", sa.Integer(), sa.ForeignKey("uploads.id")),
        sa.Column("snapshot_hash", sa.String(64)),
        sa.Column("message", sa.String(2000)),
        sa.Column("details", JSONB(), nullable=False, server_default="{}"),
    )
    op.create_table(
        "model_versions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("task", sa.String(16), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        _now(),
        sa.Column("promoted_at", sa.DateTime(timezone=True)),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("algorithm", sa.String(64), nullable=False),
        sa.Column("ml_version", sa.String(16), nullable=False),
        sa.Column("train_start", sa.Date(), nullable=False),
        sa.Column("train_end", sa.Date(), nullable=False),
        sa.Column("data_end", sa.Date(), nullable=False),
        sa.Column("n_rows", sa.Integer(), nullable=False),
        sa.Column("primary_metric", sa.String(32), nullable=False),
        sa.Column("primary_value", sa.Float(), nullable=False),
        sa.Column("metrics", JSONB(), nullable=False),
        sa.Column("params", JSONB(), nullable=False),
        sa.Column("artifact_dir", sa.String(500), nullable=False),
        sa.Column("snapshot_hash", sa.String(64), nullable=False),
        sa.Column("training_run_id", sa.Integer(), sa.ForeignKey("training_runs.id")),
        sa.UniqueConstraint("task", "version"),
    )
    # Tepat satu champion per task.
    op.create_index(
        "uq_model_versions_champion",
        "model_versions",
        ["task"],
        unique=True,
        postgresql_where=sa.text("status = 'champion'"),
    )
    op.create_table(
        "forecasts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "model_version_id", sa.Integer(), sa.ForeignKey("model_versions.id"), nullable=False
        ),
        sa.Column("station_id", sa.Integer(), sa.ForeignKey("stations.id"), nullable=False),
        _now(),
        sa.Column("origin_date", sa.Date(), nullable=False),
        sa.Column("target_date", sa.Date(), nullable=False),
        sa.Column("horizon", sa.SmallInteger(), nullable=False),
        sa.Column("values", JSONB(), nullable=False),
        sa.Column("max_yhat", sa.Float(), nullable=False),
        sa.Column("critical", sa.String(32), nullable=False),
        sa.Column("kategori", sa.String(32), nullable=False),
        sa.Column("kategori_upper", sa.String(32), nullable=False),
        sa.UniqueConstraint("station_id", "target_date"),
    )


def downgrade() -> None:
    op.drop_table("forecasts")
    op.drop_index("uq_model_versions_champion", table_name="model_versions")
    op.drop_table("model_versions")
    op.drop_table("training_runs")
