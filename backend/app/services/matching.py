"""Pareamento puro entre um snapshot CSV e um snapshot XLSX.

Sem fuzzy matching: a associacao usa exclusivamente o nome normalizado dentro
do par de snapshots escolhido. Quando mais de um documento XLSX distinto
compartilha o mesmo nome normalizado, a associacao fica ambigua e nao e
feita automaticamente (ver constraints globais do plano).
"""

from dataclasses import dataclass, field

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Debito, ObservacaoEntidade
from app.normalize import normalize_nome

CHAVE_PARCELAMENTO_CSV = normalize_nome("Parcelamento")
CHAVES_PARCELAMENTO_XLSX = {normalize_nome("Renegociado"), normalize_nome("Exercicio corrente")}


def chave_obrigacao(debito: Debito) -> tuple[int, str]:
    """Chave de obrigacao distinta: ano_referencia + tipo_debito normalizado."""
    return (debito.ano_referencia, normalize_nome(debito.tipo_debito))


def esta_parcelado_csv(debitos: list[Debito]) -> bool:
    """CSV 'Parcelamento' indica parcelamento vigente para a obrigacao."""
    return any(
        debito.situacao_parcelamento is not None
        and normalize_nome(debito.situacao_parcelamento) == CHAVE_PARCELAMENTO_CSV
        for debito in debitos
    )


def esta_parcelado_xlsx(debitos: list[Debito]) -> bool:
    """XLSX 'Renegociado' ou 'Exercicio corrente' correspondem a parcelamento do CSV."""
    return any(
        debito.situacao_parcelamento is not None
        and normalize_nome(debito.situacao_parcelamento) in CHAVES_PARCELAMENTO_XLSX
        for debito in debitos
    )


def obrigacoes_por_observacao(observacao: ObservacaoEntidade) -> dict[tuple[int, str], list[Debito]]:
    obrigacoes: dict[tuple[int, str], list[Debito]] = {}
    for debito in observacao.debitos:
        obrigacoes.setdefault(chave_obrigacao(debito), []).append(debito)
    return obrigacoes


@dataclass
class EntidadePareada:
    observacao_csv: ObservacaoEntidade
    observacao_xlsx: ObservacaoEntidade


@dataclass
class NomeAmbiguo:
    observacao_csv: ObservacaoEntidade
    candidatos_xlsx: list[ObservacaoEntidade]


@dataclass
class ResultadoPareamento:
    pareadas: list[EntidadePareada] = field(default_factory=list)
    somente_csv: list[ObservacaoEntidade] = field(default_factory=list)
    somente_xlsx: list[ObservacaoEntidade] = field(default_factory=list)
    ambiguas: list[NomeAmbiguo] = field(default_factory=list)


def _observacoes_snapshot(sessao: Session, snapshot_id: int) -> list[ObservacaoEntidade]:
    return list(
        sessao.scalars(
            select(ObservacaoEntidade)
            .where(ObservacaoEntidade.snapshot_id == snapshot_id)
            .order_by(ObservacaoEntidade.nome_normalizado, ObservacaoEntidade.id)
        ).all()
    )


def parear_snapshots(sessao: Session, csv_snapshot_id: int, xlsx_snapshot_id: int) -> ResultadoPareamento:
    """Pareia observacoes de um snapshot CSV com observacoes de um snapshot XLSX.

    Candidatos XLSX por nome normalizado do CSV:
    - zero candidatos: entidade so existe no CSV (`somente_csv`);
    - um documento distinto entre os candidatos: associacao confirmada (`pareadas`);
    - mais de um documento distinto: nome ambiguo, sem associacao automatica (`ambiguas`).

    Observacoes XLSX cujo nome normalizado nao aparece no CSV (nem via nome ambiguo)
    vao para `somente_xlsx`.
    """
    observacoes_csv = _observacoes_snapshot(sessao, csv_snapshot_id)
    observacoes_xlsx = _observacoes_snapshot(sessao, xlsx_snapshot_id)

    candidatos_por_nome: dict[str, list[ObservacaoEntidade]] = {}
    for observacao in observacoes_xlsx:
        candidatos_por_nome.setdefault(observacao.nome_normalizado, []).append(observacao)

    resultado = ResultadoPareamento()
    nomes_csv: set[str] = set()
    for observacao_csv in observacoes_csv:
        nomes_csv.add(observacao_csv.nome_normalizado)
        candidatos = candidatos_por_nome.get(observacao_csv.nome_normalizado, [])
        documentos_distintos = {candidato.entidade_id for candidato in candidatos}
        if not candidatos:
            resultado.somente_csv.append(observacao_csv)
        elif len(documentos_distintos) == 1:
            resultado.pareadas.append(EntidadePareada(observacao_csv, candidatos[0]))
        else:
            resultado.ambiguas.append(NomeAmbiguo(observacao_csv, candidatos))

    for nome, candidatos in candidatos_por_nome.items():
        if nome not in nomes_csv:
            resultado.somente_xlsx.extend(candidatos)
    resultado.somente_xlsx.sort(key=lambda observacao: (observacao.nome_normalizado, observacao.id))

    return resultado
