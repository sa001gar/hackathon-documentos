"""Fix index and FK constraints.

- Add missing FK indexes on documents.created_by, documents.template_id, ai_logs.section_id
- Add FK constraints on ai_logs.document_id, ai_logs.section_id, decisions.document_id,
  kg_nodes.document_id
- Add composite indexes: documents(project_id, status), document_versions(section_id, version),
  generation_jobs(document_id, status)
- Remove redundant indexes: memory_items.scope, kg_nodes.node_type, kg_nodes.workspace_id,
  ix_kg_nodes_workspace_type

Revision ID: 0002_fix_indexes
Revises: 0001_baseline
Create Date: 2026-07-28
"""
from alembic import op
import sqlalchemy as sa

revision = "0002_fix_indexes"
down_revision = "0001_baseline"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- documents: add index on created_by, template_id ---
    op.create_index("ix_documents_created_by", "documents", ["created_by"])
    op.create_index("ix_documents_template_id", "documents", ["template_id"])

    # --- documents: add composite index (project_id, status) ---
    op.create_index("ix_documents_project_status", "documents", ["project_id", "status"])

    # --- Clean up orphaned FK references before adding constraints ---
    op.execute(
        "DELETE FROM ai_logs WHERE section_id IS NOT NULL "
        "AND section_id NOT IN (SELECT id FROM document_sections)"
    )
    op.execute(
        "DELETE FROM ai_logs WHERE document_id IS NOT NULL "
        "AND document_id NOT IN (SELECT id FROM documents)"
    )
    op.execute(
        "DELETE FROM decisions WHERE document_id IS NOT NULL "
        "AND document_id NOT IN (SELECT id FROM documents)"
    )
    op.execute(
        "DELETE FROM kg_nodes WHERE document_id IS NOT NULL "
        "AND document_id NOT IN (SELECT id FROM documents)"
    )

    # --- ai_logs: add FK and index on section_id ---
    op.create_foreign_key(
        "fk_ai_logs_section_id",
        "ai_logs",
        "document_sections",
        ["section_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_ai_logs_section_id", "ai_logs", ["section_id"])

    # --- ai_logs: add FK on document_id ---
    op.create_foreign_key(
        "fk_ai_logs_document_id",
        "ai_logs",
        "documents",
        ["document_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # --- document_versions: add composite index (section_id, version) ---
    op.create_index("ix_versions_section_version", "document_versions", ["section_id", "version"])

    # --- generation_jobs: add composite index (document_id, status) ---
    op.create_index("ix_gen_jobs_doc_status", "generation_jobs", ["document_id", "status"])

    # --- decisions: add FK on document_id ---
    op.create_foreign_key(
        "fk_decisions_document_id",
        "decisions",
        "documents",
        ["document_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # --- kg_nodes: add FK on document_id ---
    op.create_foreign_key(
        "fk_kg_nodes_document_id",
        "kg_nodes",
        "documents",
        ["document_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # --- Remove redundant indexes ---
    op.drop_index("ix_memory_items_scope", table_name="memory_items")
    op.drop_index("ix_kg_nodes_node_type", table_name="kg_nodes")
    op.drop_index("ix_kg_nodes_workspace_id", table_name="kg_nodes")
    op.drop_index("ix_kg_nodes_workspace_type", table_name="kg_nodes")


def downgrade() -> None:
    # --- Restore dropped indexes ---
    op.create_index("ix_kg_nodes_workspace_type", "kg_nodes", ["workspace_id", "node_type"])
    op.create_index("ix_kg_nodes_workspace_id", "kg_nodes", ["workspace_id"])
    op.create_index("ix_kg_nodes_node_type", "kg_nodes", ["node_type"])
    op.create_index("ix_memory_items_scope", "memory_items", ["scope"])

    # --- Drop FKs added in upgrade ---
    op.drop_constraint("fk_kg_nodes_document_id", "kg_nodes", type_="foreignkey")
    op.drop_constraint("fk_decisions_document_id", "decisions", type_="foreignkey")

    # --- Drop composite indexes ---
    op.drop_index("ix_gen_jobs_doc_status", table_name="generation_jobs")
    op.drop_index("ix_versions_section_version", table_name="document_versions")

    # --- Drop ai_logs changes ---
    op.drop_constraint("fk_ai_logs_document_id", "ai_logs", type_="foreignkey")
    op.drop_index("ix_ai_logs_section_id", table_name="ai_logs")
    op.drop_constraint("fk_ai_logs_section_id", "ai_logs", type_="foreignkey")

    # --- Drop documents indexes ---
    op.drop_index("ix_documents_project_status", table_name="documents")
    op.drop_index("ix_documents_template_id", table_name="documents")
    op.drop_index("ix_documents_created_by", table_name="documents")
