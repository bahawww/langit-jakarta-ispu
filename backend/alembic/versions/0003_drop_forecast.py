"""hapus forecast: tabel forecasts dan versi model forecast

Revision ID: 0003
Revises: 0002
"""

from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_table("forecasts")
    op.execute("DELETE FROM model_versions WHERE task = 'forecast'")


def downgrade() -> None:
    raise NotImplementedError("forecast dihapus permanen; pulihkan dari backup bila perlu")
