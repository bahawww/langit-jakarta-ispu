"""stations, uploads, measurements, orange_baseline

Revision ID: 0001
Revises:
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def _pollutant_columns() -> list[sa.Column]:
    cols = [
        sa.Column(c, sa.SmallInteger(), nullable=False)
        for c in (
            "pm_sepuluh",
            "pm_duakomalima",
            "sulfur_dioksida",
            "karbon_monoksida",
            "ozon",
            "nitrogen_dioksida",
            "max",
        )
    ]
    return [
        *cols,
        sa.Column("parameter_pencemar_kritis", sa.String(32)),
        sa.Column("kategori", sa.String(32), nullable=False),
        sa.Column("kategori_ispu", sa.String(32), nullable=False),
    ]


def upgrade() -> None:
    op.create_table(
        "stations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("code", sa.String(16), nullable=False, unique=True),
        sa.Column("name", sa.String(200), nullable=False),
    )
    op.create_table(
        "uploads",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("source", sa.String(16), nullable=False),
        sa.Column("format", sa.String(16)),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("total_rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("inserted", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("updated", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("unchanged", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("rejected", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("rejected_details", JSONB(), nullable=False, server_default="[]"),
        sa.Column("error", sa.String(1000)),
    )
    op.create_table(
        "measurements",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tanggal", sa.Date(), nullable=False, index=True),
        sa.Column("station_id", sa.Integer(), sa.ForeignKey("stations.id"), nullable=False),
        *_pollutant_columns(),
        sa.Column("label_inconsistent", sa.Boolean(), nullable=False, index=True),
        sa.Column("upload_id", sa.Integer(), sa.ForeignKey("uploads.id")),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.UniqueConstraint("tanggal", "station_id"),
    )
    op.create_table(
        "orange_baseline",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tanggal", sa.Date(), nullable=False),
        sa.Column("station_id", sa.Integer(), sa.ForeignKey("stations.id"), nullable=False),
        *_pollutant_columns(),
        sa.Column("pred_random_forest", sa.String(32), nullable=False),
        sa.Column("pred_decision_tree", sa.String(32), nullable=False),
        sa.Column("pred_knn", sa.String(32), nullable=False),
        sa.UniqueConstraint("tanggal", "station_id"),
    )


def downgrade() -> None:
    for t in ("orange_baseline", "measurements", "uploads", "stations"):
        op.drop_table(t)
