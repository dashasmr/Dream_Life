"""goals table

Revision ID: 0012_goals
Revises: 0011_ai_reviews
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0012_goals"
down_revision: Union[str, None] = "0011_ai_reviews"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "goals",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("category", sa.String(length=32), nullable=False),
        sa.Column("target_value", sa.Numeric(14, 4), nullable=False),
        sa.Column("unit", sa.String(length=16), nullable=False),
        sa.Column("period", sa.String(length=16), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )


def downgrade() -> None:
    op.drop_table("goals")
