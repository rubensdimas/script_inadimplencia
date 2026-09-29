"""Uniformiza travessões nas chaves de nome dos snapshots existentes.

Revision ID: 0003_normalize_name_dashes
Revises: 0002_historical_observations
"""

import unicodedata

from alembic import op
import sqlalchemy as sa

revision = "0003_normalize_name_dashes"
down_revision = "0002_historical_observations"
branch_labels = None
depends_on = None


def _normalizar(nome: str, *, uniformizar_travessoes: bool) -> str:
    if uniformizar_travessoes:
        nome = "".join("-" if unicodedata.category(caractere) == "Pd" else caractere for caractere in nome)
    sem_acento = unicodedata.normalize("NFKD", nome).encode("ascii", "ignore").decode("ascii")
    return " ".join(sem_acento.upper().split())


def _atualizar_chaves(*, uniformizar_travessoes: bool) -> None:
    bind = op.get_bind()
    tabela = sa.table(
        "observacoes_entidades",
        sa.column("id", sa.Integer),
        sa.column("nome_original", sa.String),
        sa.column("nome_normalizado", sa.String),
    )
    for observacao_id, nome_original, nome_normalizado in bind.execute(
        sa.select(tabela.c.id, tabela.c.nome_original, tabela.c.nome_normalizado)
    ):
        novo_nome = _normalizar(nome_original, uniformizar_travessoes=uniformizar_travessoes)
        if novo_nome != nome_normalizado:
            bind.execute(
                sa.update(tabela).where(tabela.c.id == observacao_id).values(nome_normalizado=novo_nome)
            )


def upgrade() -> None:
    _atualizar_chaves(uniformizar_travessoes=True)


def downgrade() -> None:
    _atualizar_chaves(uniformizar_travessoes=False)
