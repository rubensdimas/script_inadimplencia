"""Cria identidade por documento e observacoes imutaveis por snapshot.

Revision ID: 0002_historical_observations
Revises: 0001_legacy_baseline
"""

import re
from collections import defaultdict

from alembic import op
import sqlalchemy as sa

revision = "0002_historical_observations"
down_revision = "0001_legacy_baseline"
branch_labels = None
depends_on = None


def _documento_valido(valor: str | None) -> str | None:
    if not valor:
        return None
    documento = re.sub(r"\D", "", valor)
    return documento if len(documento) in (11, 14) else None


def _criar_novo_modelo() -> None:
    op.create_table(
        "entidades_novas",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("documento_normalizado", sa.String(14), nullable=False),
        sa.Column("tipo_pessoa", sa.String(20), nullable=True),
    )
    op.create_index(
        "ix_entidades_novas_documento_normalizado",
        "entidades_novas",
        ["documento_normalizado"],
        unique=True,
    )
    op.create_table(
        "observacoes_entidades_novas",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("snapshot_id", sa.Integer(), sa.ForeignKey("snapshots.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "entidade_id",
            sa.Integer(),
            sa.ForeignKey("entidades_novas.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("nome_original", sa.String(255), nullable=False),
        sa.Column("nome_normalizado", sa.String(255), nullable=False),
        sa.Column("cpf_cnpj", sa.String(20), nullable=True),
        sa.Column("tipo_pessoa", sa.String(20), nullable=True),
        sa.Column("registro_resumido", sa.String(255), nullable=True),
        sa.Column("categoria", sa.String(50), nullable=True),
        sa.Column("subregiao", sa.String(100), nullable=True),
        sa.Column("situacao_registro", sa.String(50), nullable=True),
    )
    op.create_index(
        "ix_observacoes_entidades_novas_snapshot_id",
        "observacoes_entidades_novas",
        ["snapshot_id"],
    )
    op.create_index(
        "ix_observacoes_entidades_novas_entidade_id",
        "observacoes_entidades_novas",
        ["entidade_id"],
    )
    op.create_index(
        "ix_observacoes_entidades_novas_nome_normalizado",
        "observacoes_entidades_novas",
        ["nome_normalizado"],
    )
    op.create_table(
        "debitos_novos",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "observacao_id",
            sa.Integer(),
            sa.ForeignKey("observacoes_entidades_novas.id", ondelete="CASCADE"),
            nullable=False,
        ),
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
    op.create_index("ix_debitos_novos_observacao_id", "debitos_novos", ["observacao_id"])


def upgrade() -> None:
    bind = op.get_bind()
    existentes = set(sa.inspect(bind).get_table_names())
    if "observacoes_entidades" in existentes:
        return

    op.rename_table("debitos", "debitos_legacy")
    op.rename_table("entidades", "entidades_legacy")
    _criar_novo_modelo()

    meta = sa.MetaData()
    snapshots = sa.Table("snapshots", meta, autoload_with=bind)
    entidades_legacy = sa.Table("entidades_legacy", meta, autoload_with=bind)
    debitos_legacy = sa.Table("debitos_legacy", meta, autoload_with=bind)
    entidades = sa.Table("entidades_novas", meta, autoload_with=bind)
    observacoes = sa.Table("observacoes_entidades_novas", meta, autoload_with=bind)
    debitos = sa.Table("debitos_novos", meta, autoload_with=bind)

    entidades_antigas = {
        linha["id"]: linha for linha in bind.execute(sa.select(entidades_legacy)).mappings()
    }
    tipos_snapshot = dict(
        bind.execute(sa.select(snapshots.c.id, snapshots.c.tipo_arquivo)).all()
    )
    ids_por_documento: dict[str, int] = {}
    for entidade_antiga in entidades_antigas.values():
        documento = _documento_valido(entidade_antiga["cpf_cnpj"])
        if documento is None or documento in ids_por_documento:
            continue
        entidade_id = bind.execute(
            sa.insert(entidades)
            .values(
                documento_normalizado=documento,
                tipo_pessoa=entidade_antiga["tipo_pessoa"],
            )
            .returning(entidades.c.id)
        ).scalar_one()
        ids_por_documento[documento] = entidade_id

    grupos = defaultdict(list)
    for debito_antigo in bind.execute(sa.select(debitos_legacy)).mappings():
        grupos[(debito_antigo["snapshot_id"], debito_antigo["entidade_id"])].append(debito_antigo)

    campos_debito = [
        "id", "origem", "ano_referencia", "tipo_debito", "numero_parcela",
        "data_vencimento", "valor_original", "valor_devido", "valor_total",
        "situacao_pagamento", "situacao_divida_ativa", "situacao_parcelamento",
    ]
    for (snapshot_id, entidade_antiga_id), grupo in sorted(grupos.items()):
        antiga = entidades_antigas[entidade_antiga_id]
        eh_xlsx = tipos_snapshot[snapshot_id] == "xlsx"
        documento = _documento_valido(antiga["cpf_cnpj"]) if eh_xlsx else None
        observacao_id = bind.execute(
            sa.insert(observacoes)
            .values(
                snapshot_id=snapshot_id,
                entidade_id=ids_por_documento.get(documento),
                nome_original=antiga["nome_original"],
                nome_normalizado=antiga["nome_normalizado"],
                cpf_cnpj=antiga["cpf_cnpj"] if eh_xlsx else None,
                tipo_pessoa=antiga["tipo_pessoa"] if eh_xlsx else None,
                registro_resumido=None,
                categoria=antiga["categoria"] if eh_xlsx else None,
                subregiao=antiga["subregiao"] if eh_xlsx else None,
                situacao_registro=antiga["situacao_registro"] if eh_xlsx else None,
            )
            .returning(observacoes.c.id)
        ).scalar_one()
        for antigo in grupo:
            valores = {campo: antigo[campo] for campo in campos_debito}
            valores["observacao_id"] = observacao_id
            bind.execute(sa.insert(debitos).values(**valores))

    bind.execute(
        sa.text(
            "SELECT setval("
            "pg_get_serial_sequence('debitos_novos', 'id'), "
            "COALESCE((SELECT MAX(id) FROM debitos_novos), 1), "
            "EXISTS (SELECT 1 FROM debitos_novos))"
        )
    )

    op.drop_table("debitos_legacy")
    op.drop_index("ix_entidades_nome_normalizado", table_name="entidades_legacy")
    op.drop_table("entidades_legacy")
    op.rename_table("entidades_novas", "entidades")
    op.rename_table("observacoes_entidades_novas", "observacoes_entidades")
    op.rename_table("debitos_novos", "debitos")
    op.execute(
        "ALTER INDEX ix_entidades_novas_documento_normalizado "
        "RENAME TO ix_entidades_documento_normalizado"
    )
    op.execute(
        "ALTER INDEX ix_observacoes_entidades_novas_snapshot_id "
        "RENAME TO ix_observacoes_entidades_snapshot_id"
    )
    op.execute(
        "ALTER INDEX ix_observacoes_entidades_novas_entidade_id "
        "RENAME TO ix_observacoes_entidades_entidade_id"
    )
    op.execute(
        "ALTER INDEX ix_observacoes_entidades_novas_nome_normalizado "
        "RENAME TO ix_observacoes_entidades_nome_normalizado"
    )
    op.execute(
        "ALTER INDEX ix_debitos_novos_observacao_id RENAME TO ix_debitos_observacao_id"
    )


def downgrade() -> None:
    raise RuntimeError("a revisao historica nao possui downgrade sem perda de dados")
