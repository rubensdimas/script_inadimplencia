"""Exportacao de datasets em CSV/XLSX.

Nao reimplementa consultas: cada dataset exportavel chama o mesmo servico que
alimenta o endpoint JSON equivalente (`montar_dashboard`, `montar_comparacao`,
`montar_pendencias_pareamento`, `listar_entidades_filtradas`) e so cuida de
achatar o resultado em linhas e serializar para bytes. Isso garante que
mascaramento de documento e filtros fiquem identicos entre API e exportacao
(ver preflight ruling "1 -> 3" / "2 -> 3").

Escolha para `dataset=ranking` (nao existe `/api/ranking` isolado -- os dois
rankings vivem dentro de `/api/dashboard`, spec user stories 13 e 15): a
exportacao cobre as duas metricas (total de obrigacoes distintas e soma de
`valor_total`) numa unica linha por entidade XLSX, ja que ambos os rankings
partem do mesmo conjunto de observacoes do snapshot XLSX escolhido. As linhas
saem ordenadas por `valor_total` decrescente porque a constraint global marca
ValorTotal como "a metrica financeira principal"; a posicao de cada ranking
tambem e exposta como coluna para quem quiser reordenar por obrigacoes.
"""

import csv
from dataclasses import dataclass
from datetime import datetime, timezone
from io import BytesIO, StringIO

from openpyxl import Workbook
from sqlalchemy.orm import Session

from app.schemas import ComparacaoOut, DashboardOut, PendenciasPareamentoOut
from app.services.analytics import montar_comparacao, montar_dashboard, montar_pendencias_pareamento
from app.services.entities import listar_entidades_filtradas

MEDIA_TYPE_CSV = "text/csv"
MEDIA_TYPE_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

DATASETS = ("ranking", "comparisons", "entities", "matching-issues")
FORMATOS = ("csv", "xlsx")


@dataclass
class ExportacaoArquivo:
    conteudo: bytes
    nome_arquivo: str
    media_type: str


# --- Serializacao generica -------------------------------------------------


def _texto(valor: object) -> str:
    if valor is None:
        return ""
    if isinstance(valor, bool):
        return "sim" if valor else "nao"
    return str(valor)


def _valor_celula_xlsx(valor: object) -> object:
    if isinstance(valor, bool):
        return "sim" if valor else "nao"
    return valor


def _escrever_csv(cabecalho: list[str], linhas: list[list[object]]) -> bytes:
    buffer = StringIO()
    escritor = csv.writer(buffer, delimiter=";")
    escritor.writerow(cabecalho)
    for linha in linhas:
        escritor.writerow([_texto(valor) for valor in linha])
    return buffer.getvalue().encode("utf-8-sig")


def _escrever_xlsx(cabecalho: list[str], linhas: list[list[object]]) -> bytes:
    pasta = Workbook()
    aba = pasta.active
    aba.title = "Dados"
    aba.append(cabecalho)
    for linha in linhas:
        aba.append([_valor_celula_xlsx(valor) for valor in linha])
    saida = BytesIO()
    pasta.save(saida)
    return saida.getvalue()


def _serializar(dataset: str, formato: str, cabecalho: list[str], linhas: list[list[object]]) -> ExportacaoArquivo:
    if formato == "csv":
        conteudo = _escrever_csv(cabecalho, linhas)
        media_type = MEDIA_TYPE_CSV
        extensao = "csv"
    elif formato == "xlsx":
        conteudo = _escrever_xlsx(cabecalho, linhas)
        media_type = MEDIA_TYPE_XLSX
        extensao = "xlsx"
    else:
        raise ValueError(f"formato de exportacao invalido: {formato}")

    carimbo = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    return ExportacaoArquivo(
        conteudo=conteudo,
        nome_arquivo=f"{dataset}_{carimbo}.{extensao}",
        media_type=media_type,
    )


# --- dataset=ranking ---------------------------------------------------


def _linhas_ranking(dashboard: DashboardOut) -> tuple[list[str], list[list[object]]]:
    total_obrigacoes_por_obs: dict[int, int] = {}
    posicao_obrigacoes_por_obs: dict[int, int] = {}
    for posicao, item in enumerate(dashboard.ranking_obrigacoes, start=1):
        obs_id = item.entidade.observacao_id
        total_obrigacoes_por_obs[obs_id] = item.total_obrigacoes
        posicao_obrigacoes_por_obs[obs_id] = posicao

    cabecalho = [
        "posicao_valor_total",
        "nome",
        "documento_mascarado",
        "tipo_pessoa",
        "valor_total",
        "posicao_obrigacoes",
        "total_obrigacoes_distintas",
    ]
    linhas: list[list[object]] = []
    for posicao, item in enumerate(dashboard.ranking_valor_total, start=1):
        obs_id = item.entidade.observacao_id
        linhas.append(
            [
                posicao,
                item.entidade.nome_original,
                item.entidade.cpf_cnpj,
                item.entidade.tipo_pessoa,
                item.valor_total,
                posicao_obrigacoes_por_obs.get(obs_id),
                total_obrigacoes_por_obs.get(obs_id),
            ]
        )
    return cabecalho, linhas


def gerar_exportacao_ranking(
    sessao: Session, *, csv_snapshot_id: int, xlsx_snapshot_id: int, formato: str
) -> ExportacaoArquivo:
    dashboard = montar_dashboard(sessao, csv_snapshot_id, xlsx_snapshot_id)
    cabecalho, linhas = _linhas_ranking(dashboard)
    return _serializar(f"ranking_csv{csv_snapshot_id}_xlsx{xlsx_snapshot_id}", formato, cabecalho, linhas)


# --- dataset=comparisons ------------------------------------------------


def _linhas_comparisons(comparacao: ComparacaoOut) -> tuple[list[str], list[list[object]]]:
    cabecalho = [
        "categoria",
        "nome",
        "documento_mascarado",
        "tipo_pessoa",
        "ano_referencia",
        "tipo_debito",
        "parcelado_csv",
        "parcelado_xlsx",
    ]
    linhas: list[list[object]] = []

    for entidade in comparacao.entidades_somente_csv:
        linhas.append(["somente_csv", entidade.nome_original, entidade.cpf_cnpj, entidade.tipo_pessoa, "", "", "", ""])
    for entidade in comparacao.entidades_somente_xlsx:
        linhas.append(
            ["somente_xlsx", entidade.nome_original, entidade.cpf_cnpj, entidade.tipo_pessoa, "", "", "", ""]
        )
    for obrigacao in comparacao.obrigacoes_somente_csv:
        linhas.append(
            [
                "obrigacao_somente_csv",
                obrigacao.entidade.nome_original,
                obrigacao.entidade.cpf_cnpj,
                obrigacao.entidade.tipo_pessoa,
                obrigacao.ano_referencia,
                obrigacao.tipo_debito,
                "",
                "",
            ]
        )
    for obrigacao in comparacao.obrigacoes_somente_xlsx:
        linhas.append(
            [
                "obrigacao_somente_xlsx",
                obrigacao.entidade.nome_original,
                obrigacao.entidade.cpf_cnpj,
                obrigacao.entidade.tipo_pessoa,
                obrigacao.ano_referencia,
                obrigacao.tipo_debito,
                "",
                "",
            ]
        )
    for conflito in comparacao.conflitos_parcelamento:
        linhas.append(
            [
                "conflito_parcelamento",
                conflito.entidade.nome_original,
                conflito.entidade.cpf_cnpj,
                conflito.entidade.tipo_pessoa,
                conflito.ano_referencia,
                conflito.tipo_debito,
                conflito.parcelado_csv,
                conflito.parcelado_xlsx,
            ]
        )
    for ambiguo in comparacao.nomes_ambiguos:
        for candidato in ambiguo.candidatos_xlsx:
            linhas.append(
                ["nome_ambiguo", candidato.nome_original, candidato.cpf_cnpj, candidato.tipo_pessoa, "", "", "", ""]
            )

    return cabecalho, linhas


def gerar_exportacao_comparisons(
    sessao: Session, *, csv_snapshot_id: int, xlsx_snapshot_id: int, formato: str
) -> ExportacaoArquivo:
    comparacao = montar_comparacao(sessao, csv_snapshot_id, xlsx_snapshot_id)
    cabecalho, linhas = _linhas_comparisons(comparacao)
    return _serializar(f"comparisons_csv{csv_snapshot_id}_xlsx{xlsx_snapshot_id}", formato, cabecalho, linhas)


# --- dataset=matching-issues ---------------------------------------------


def _linhas_matching_issues(pendencias: PendenciasPareamentoOut) -> tuple[list[str], list[list[object]]]:
    cabecalho = ["categoria", "nome_normalizado_ambiguo", "nome", "documento_mascarado", "tipo_pessoa"]
    linhas: list[list[object]] = []

    for entidade in pendencias.somente_csv:
        linhas.append(["somente_csv", "", entidade.nome_original, entidade.cpf_cnpj, entidade.tipo_pessoa])
    for entidade in pendencias.somente_xlsx:
        linhas.append(["somente_xlsx", "", entidade.nome_original, entidade.cpf_cnpj, entidade.tipo_pessoa])
    for ambiguo in pendencias.nomes_ambiguos:
        for candidato in ambiguo.candidatos_xlsx:
            linhas.append(
                [
                    "nome_ambiguo",
                    ambiguo.nome_normalizado,
                    candidato.nome_original,
                    candidato.cpf_cnpj,
                    candidato.tipo_pessoa,
                ]
            )

    return cabecalho, linhas


def gerar_exportacao_matching_issues(
    sessao: Session, *, csv_snapshot_id: int, xlsx_snapshot_id: int, formato: str
) -> ExportacaoArquivo:
    pendencias = montar_pendencias_pareamento(sessao, csv_snapshot_id, xlsx_snapshot_id)
    cabecalho, linhas = _linhas_matching_issues(pendencias)
    return _serializar(f"matching-issues_csv{csv_snapshot_id}_xlsx{xlsx_snapshot_id}", formato, cabecalho, linhas)


# --- dataset=entities ------------------------------------------------------


def gerar_exportacao_entities(
    sessao: Session,
    *,
    query: str | None,
    tipo_pessoa: str | None,
    situacao_registro: str | None,
    formato: str,
) -> ExportacaoArquivo:
    observacoes = listar_entidades_filtradas(
        sessao, query=query, tipo_pessoa=tipo_pessoa, situacao_registro=situacao_registro
    )
    cabecalho = [
        "entidade_id",
        "nome",
        "documento_mascarado",
        "tipo_pessoa",
        "categoria",
        "subregiao",
        "situacao_registro",
        "registro_resumido",
    ]
    linhas = [
        [
            observacao.entidade_id,
            observacao.nome_original,
            observacao.cpf_cnpj_mascarado,
            observacao.tipo_pessoa,
            observacao.categoria,
            observacao.subregiao,
            observacao.situacao_registro,
            observacao.registro_resumido,
        ]
        for observacao in observacoes
    ]
    return _serializar("entities", formato, cabecalho, linhas)
