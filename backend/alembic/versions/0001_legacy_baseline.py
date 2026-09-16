"""Baseline do modelo legado anterior ao historico.

Revision ID: 0001_legacy_baseline
Revises:
"""

from alembic import op
import sqlalchemy as sa

revision = "0001_legacy_baseline"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    existentes = set(sa.inspect(op.get_bind()).get_table_names())
    if "snapshots" not in existentes:
        op.create_table(
            "snapshots",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("tipo_arquivo", sa.String(10), nullable=False),
            sa.Column("nome_arquivo_original", sa.String(255), nullable=False),
            sa.Column("caminho_arquivo_bruto", sa.String(500), nullable=False),
            sa.Column("data_snapshot", sa.DateTime(), nullable=False),
            sa.Column("data_upload", sa.DateTime(), nullable=False),
        )
    if "entidades" not in existentes:
        op.create_table(
            "entidades",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("nome_normalizado", sa.String(255), nullable=False),
            sa.Column("nome_original", sa.String(255), nullable=False),
            sa.Column("cpf_cnpj", sa.String(20), nullable=True),
            sa.Column("tipo_pessoa", sa.String(20), nullable=True),
            sa.Column("categoria", sa.String(50), nullable=True),
            sa.Column("subregiao", sa.String(100), nullable=True),
            sa.Column("situacao_registro", sa.String(50), nullable=True),
            sa.UniqueConstraint("nome_normalizado"),
        )
        op.create_index("ix_entidades_nome_normalizado", "entidades", ["nome_normalizado"])
    if "debitos" not in existentes:
        op.create_table(
            "debitos",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("snapshot_id", sa.Integer(), sa.ForeignKey("snapshots.id"), nullable=False),
            sa.Column("entidade_id", sa.Integer(), sa.ForeignKey("entidades.id"), nullable=False),
            sa.Column("origem", sa.String(10), nullable=False),
            sa.Column("ano_referencia", sa.Integer(), nullable=False),
            sa.Column("tipo_debito", sa.String(50), nullable=False),
            sa.Column("numero_parcela", sa.Integer(), nullable=True),
            sa.Column("data_vencimento", sa.Date(), nullable=True),
            sa.Column("valor_original", sa.Numeric(12, 2), nullable=True),
            sa.Column("valor_devido", sa.Numeric(12, 2), nullable=True),
            sa.Column("valor_total", sa.Numeric(12, 2), nullable=True),
            sa.Column("situacao_pagamento", sa.String(50), nullable=True),
            sa.Column("situacao_divida_ativa", sa.String(50), nullable=True),
            sa.Column("situacao_parcelamento", sa.String(50), nullable=True),
        )


def downgrade() -> None:
    op.drop_table("debitos")
    op.drop_index("ix_entidades_nome_normalizado", table_name="entidades")
    op.drop_table("entidades")
    op.drop_table("snapshots")
