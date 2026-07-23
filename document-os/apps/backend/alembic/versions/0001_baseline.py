"""Baseline schema (all DocumentOS tables).

Generated from SQLAlchemy metadata so it stays in sync with app/models.
For greenfield PostgreSQL deployments:
    alembic upgrade head

Revision ID: 0001_baseline
Revises:
Create Date: 2026-07-23
"""
from alembic import op
from sqlalchemy import engine_from_config

from app.db.session import Base
from app import models  # noqa: F401  (register all tables)

revision = "0001_baseline"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)


def downgrade() -> None:
    bind = op.get_bind()
    Base.metadata.drop_all(bind=bind)
