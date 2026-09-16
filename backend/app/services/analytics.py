"""Consultas analiticas (comparacao e dashboard) construidas sobre `matching.py`.

Todos os calculos partem de `ObservacaoEntidade`/`Debito` do(s) snapshot(s)
escolhidos -- nunca de campos "ao vivo" de `Entidade` -- porque dados
cadastrais sao observacoes imutaveis por snapshot.
"""

from collections import defaultdict
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models import Debito, ObservacaoEntidade, Snapshot
from app.normalize import normalize_nome
from app.schemas import (
    ComparacaoOut,
    ConflitoParcelamentoOut,
    DashboardOut,
    DebitoDividaAtivaOut,
    DistribuicaoAnoOut,
    DistribuicaoSituacaoCadastralOut,
    DistribuicaoSituacaoPagamentoOut,
    DistribuicaoTipoOut,
    EntidadeResumoOut,
    IndicadoresDashboardOut,
    NomeAmbiguoOut,
    ObrigacaoExclusivaOut,
    PendenciasPareamentoOut,
    PontoSerieHistoricaOut,
    RankingObrigacoesItemOut,
    RankingValorTotalItemOut,
    ResumoComparacaoOut,
)
from app.services.matching import (
    CHAVE_PARCELAMENTO_CSV,
    NomeAmbiguo,
    chave_obrigacao,
    esta_parcelado_csv,
    esta_parcelado_xlsx,
    obrigacoes_por_observacao,
    parear_snapshots,
)

_PRIORIDADE_DIVIDA_ATIVA = {normalize_nome("Executiva"): 0, normalize_nome("Administrativa"): 1}
_SEM_SITUACAO_PAGAMENTO = "NAO_INFORMADO"
_SEM_SITUACAO_REGISTRO = "NAO_INFORMADO"
_CHAVE_PAGO = normalize_nome("Pago")


def _em_divida_ativa(situacao: str | None) -> bool:
    return situacao is not None and normalize_nome(situacao) in _PRIORIDADE_DIVIDA_ATIVA


def _debito_esta_aberto(debito: Debito) -> bool:
    """Um debito conta como "em aberto" a menos que a fonte marque explicitamente 'Pago'.

    Situacao desconhecida (None) e tratada como aberta: numa ferramenta de inadimplencia, um
    registro sem status de pagamento nao deve ser lido como quitado.
    """
    if debito.situacao_pagamento is None:
        return True
    return normalize_nome(debito.situacao_pagamento) != _CHAVE_PAGO


def _tem_debito_aberto(observacao: ObservacaoEntidade) -> bool:
    return any(_debito_esta_aberto(debito) for debito in observacao.debitos)


def _construir_nomes_ambiguos(ambiguas: list[NomeAmbiguo]) -> list[NomeAmbiguoOut]:
    return [
        NomeAmbiguoOut(
            nome_normalizado=ambiguo.observacao_csv.nome_normalizado,
            nome_csv=EntidadeResumoOut.model_validate(ambiguo.observacao_csv),
            candidatos_xlsx=[
                EntidadeResumoOut.model_validate(candidato) for candidato in ambiguo.candidatos_xlsx
            ],
        )
        for ambiguo in ambiguas
    ]


def montar_pendencias_pareamento(
    sessao: Session, csv_snapshot_id: int, xlsx_snapshot_id: int
) -> PendenciasPareamentoOut:
    """Pendencias de pareamento (spec story 22): nomes que nao bateram exatamente
    entre CSV e XLSX no par de snapshots selecionado, agrupados para revisao manual."""
    pareamento = parear_snapshots(sessao, csv_snapshot_id, xlsx_snapshot_id)
    return PendenciasPareamentoOut(
        csv_snapshot_id=csv_snapshot_id,
        xlsx_snapshot_id=xlsx_snapshot_id,
        somente_csv=[EntidadeResumoOut.model_validate(o) for o in pareamento.somente_csv],
        somente_xlsx=[EntidadeResumoOut.model_validate(o) for o in pareamento.somente_xlsx],
        nomes_ambiguos=_construir_nomes_ambiguos(pareamento.ambiguas),
    )


def montar_comparacao(sessao: Session, csv_snapshot_id: int, xlsx_snapshot_id: int) -> ComparacaoOut:
    pareamento = parear_snapshots(sessao, csv_snapshot_id, xlsx_snapshot_id)

    obrigacoes_somente_csv: list[ObrigacaoExclusivaOut] = []
    obrigacoes_somente_xlsx: list[ObrigacaoExclusivaOut] = []
    conflitos: list[ConflitoParcelamentoOut] = []

    for par in pareamento.pareadas:
        entidade_out = EntidadeResumoOut.model_validate(par.observacao_xlsx)
        obrig_csv = obrigacoes_por_observacao(par.observacao_csv)
        obrig_xlsx = obrigacoes_por_observacao(par.observacao_xlsx)

        for chave in sorted(set(obrig_csv) | set(obrig_xlsx)):
            ano, _tipo_normalizado = chave
            debitos_csv = obrig_csv.get(chave)
            debitos_xlsx = obrig_xlsx.get(chave)
            tipo_exibicao = (debitos_csv or debitos_xlsx)[0].tipo_debito

            if debitos_csv is not None and debitos_xlsx is None:
                obrigacoes_somente_csv.append(
                    ObrigacaoExclusivaOut(entidade=entidade_out, ano_referencia=ano, tipo_debito=tipo_exibicao)
                )
            elif debitos_xlsx is not None and debitos_csv is None:
                obrigacoes_somente_xlsx.append(
                    ObrigacaoExclusivaOut(entidade=entidade_out, ano_referencia=ano, tipo_debito=tipo_exibicao)
                )
            else:
                parcelado_csv = esta_parcelado_csv(debitos_csv)
                parcelado_xlsx = esta_parcelado_xlsx(debitos_xlsx)
                if parcelado_csv != parcelado_xlsx:
                    conflitos.append(
                        ConflitoParcelamentoOut(
                            entidade=entidade_out,
                            ano_referencia=ano,
                            tipo_debito=tipo_exibicao,
                            parcelado_csv=parcelado_csv,
                            parcelado_xlsx=parcelado_xlsx,
                        )
                    )

    def _ordem_obrigacao(item: ObrigacaoExclusivaOut) -> tuple[str, int, str]:
        return (item.entidade.nome_normalizado, item.ano_referencia, item.tipo_debito)

    obrigacoes_somente_csv.sort(key=_ordem_obrigacao)
    obrigacoes_somente_xlsx.sort(key=_ordem_obrigacao)
    conflitos.sort(key=lambda item: (item.entidade.nome_normalizado, item.ano_referencia, item.tipo_debito))

    nomes_ambiguos = _construir_nomes_ambiguos(pareamento.ambiguas)

    resumo = ResumoComparacaoOut(
        csv_snapshot_id=csv_snapshot_id,
        xlsx_snapshot_id=xlsx_snapshot_id,
        total_csv=len(pareamento.pareadas) + len(pareamento.somente_csv) + len(pareamento.ambiguas),
        total_xlsx=(
            len(pareamento.pareadas)
            + len(pareamento.somente_xlsx)
            + sum(len(ambiguo.candidatos_xlsx) for ambiguo in pareamento.ambiguas)
        ),
        total_pareados=len(pareamento.pareadas),
        total_somente_csv=len(pareamento.somente_csv),
        total_somente_xlsx=len(pareamento.somente_xlsx),
        total_nomes_ambiguos=len(pareamento.ambiguas),
        total_obrigacoes_somente_csv=len(obrigacoes_somente_csv),
        total_obrigacoes_somente_xlsx=len(obrigacoes_somente_xlsx),
        total_conflitos_parcelamento=len(conflitos),
    )

    return ComparacaoOut(
        resumo=resumo,
        entidades_somente_csv=[EntidadeResumoOut.model_validate(o) for o in pareamento.somente_csv],
        entidades_somente_xlsx=[EntidadeResumoOut.model_validate(o) for o in pareamento.somente_xlsx],
        obrigacoes_somente_csv=obrigacoes_somente_csv,
        obrigacoes_somente_xlsx=obrigacoes_somente_xlsx,
        conflitos_parcelamento=conflitos,
        nomes_ambiguos=nomes_ambiguos,
    )


def _observacoes_xlsx_com_debitos(sessao: Session, snapshot_id: int) -> list[ObservacaoEntidade]:
    return list(
        sessao.scalars(
            select(ObservacaoEntidade)
            .where(ObservacaoEntidade.snapshot_id == snapshot_id)
            .options(joinedload(ObservacaoEntidade.debitos))
            .order_by(ObservacaoEntidade.nome_normalizado, ObservacaoEntidade.id)
        )
        .unique()
        .all()
    )


def _total_parcelas_em_aberto_csv(sessao: Session, csv_snapshot_id: int) -> int:
    situacoes = sessao.scalars(
        select(Debito.situacao_parcelamento)
        .join(ObservacaoEntidade)
        .where(ObservacaoEntidade.snapshot_id == csv_snapshot_id)
    ).all()
    return sum(
        1 for situacao in situacoes if situacao is not None and normalize_nome(situacao) == CHAVE_PARCELAMENTO_CSV
    )


def _serie_historica_xlsx(sessao: Session) -> list[PontoSerieHistoricaOut]:
    snapshots = sessao.scalars(
        select(Snapshot).where(Snapshot.tipo_arquivo == "xlsx").order_by(Snapshot.data_snapshot, Snapshot.id)
    ).all()

    pontos: list[PontoSerieHistoricaOut] = []
    for snapshot in snapshots:
        observacoes = sessao.scalars(
            select(ObservacaoEntidade.id).where(ObservacaoEntidade.snapshot_id == snapshot.id)
        ).all()
        debitos = sessao.scalars(
            select(Debito).join(ObservacaoEntidade).where(ObservacaoEntidade.snapshot_id == snapshot.id)
        ).all()
        total_valor = sum((debito.valor_total or Decimal("0") for debito in debitos), Decimal("0"))
        total_divida_ativa = sum(1 for debito in debitos if _em_divida_ativa(debito.situacao_divida_ativa))
        pontos.append(
            PontoSerieHistoricaOut(
                snapshot_id=snapshot.id,
                data_snapshot=snapshot.data_snapshot,
                total_entidades=len(observacoes),
                total_valor_total=total_valor,
                total_divida_ativa=total_divida_ativa,
            )
        )
    return pontos


def montar_dashboard(sessao: Session, csv_snapshot_id: int, xlsx_snapshot_id: int) -> DashboardOut:
    observacoes = _observacoes_xlsx_com_debitos(sessao, xlsx_snapshot_id)

    total_obrigacoes = 0
    total_valor = Decimal("0")
    total_divida_ativa = 0
    total_divida_ativa_executiva = 0

    ranking_obrigacoes_dados: list[tuple[EntidadeResumoOut, int]] = []
    ranking_valor_dados: list[tuple[EntidadeResumoOut, Decimal]] = []
    divida_ativa_dados: list[tuple[EntidadeResumoOut, int, str, str, Decimal | None]] = []

    ano_qtd: dict[int, int] = defaultdict(int)
    ano_valor: dict[int, Decimal] = defaultdict(lambda: Decimal("0"))
    tipo_qtd: dict[str, int] = defaultdict(int)
    tipo_valor: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
    situacao_qtd: dict[str, int] = defaultdict(int)
    situacao_valor: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
    situacao_cadastral_total: dict[str, int] = defaultdict(int)
    situacao_cadastral_aberto: dict[str, int] = defaultdict(int)

    for observacao in observacoes:
        entidade_out = EntidadeResumoOut.model_validate(observacao)
        obrigacoes_distintas = {chave_obrigacao(debito) for debito in observacao.debitos}
        total_obrigacoes += len(obrigacoes_distintas)
        ranking_obrigacoes_dados.append((entidade_out, len(obrigacoes_distintas)))

        situacao_registro = observacao.situacao_registro or _SEM_SITUACAO_REGISTRO
        situacao_cadastral_total[situacao_registro] += 1
        if _tem_debito_aberto(observacao):
            situacao_cadastral_aberto[situacao_registro] += 1

        valor_entidade = Decimal("0")
        for debito in observacao.debitos:
            valor = debito.valor_total or Decimal("0")
            valor_entidade += valor
            total_valor += valor

            ano_qtd[debito.ano_referencia] += 1
            ano_valor[debito.ano_referencia] += valor

            tipo_qtd[debito.tipo_debito] += 1
            tipo_valor[debito.tipo_debito] += valor

            situacao = debito.situacao_pagamento or _SEM_SITUACAO_PAGAMENTO
            situacao_qtd[situacao] += 1
            situacao_valor[situacao] += valor

            if _em_divida_ativa(debito.situacao_divida_ativa):
                total_divida_ativa += 1
                if normalize_nome(debito.situacao_divida_ativa) == normalize_nome("Executiva"):
                    total_divida_ativa_executiva += 1
                divida_ativa_dados.append(
                    (
                        entidade_out,
                        debito.ano_referencia,
                        debito.tipo_debito,
                        debito.situacao_divida_ativa,
                        debito.valor_total,
                    )
                )

        ranking_valor_dados.append((entidade_out, valor_entidade))

    ranking_obrigacoes_dados.sort(key=lambda item: (-item[1], item[0].nome_normalizado))
    ranking_valor_dados.sort(key=lambda item: (-item[1], item[0].nome_normalizado))
    divida_ativa_dados.sort(
        key=lambda item: (
            _PRIORIDADE_DIVIDA_ATIVA[normalize_nome(item[3])],
            -(item[4] if item[4] is not None else Decimal("0")),
            item[0].nome_normalizado,
        )
    )

    indicadores = IndicadoresDashboardOut(
        csv_snapshot_id=csv_snapshot_id,
        xlsx_snapshot_id=xlsx_snapshot_id,
        total_entidades_xlsx=len(observacoes),
        total_obrigacoes_distintas_xlsx=total_obrigacoes,
        total_valor_total_xlsx=total_valor,
        total_parcelas_em_aberto_csv=_total_parcelas_em_aberto_csv(sessao, csv_snapshot_id),
        total_debitos_divida_ativa=total_divida_ativa,
        total_debitos_divida_ativa_executiva=total_divida_ativa_executiva,
    )

    return DashboardOut(
        indicadores=indicadores,
        ranking_obrigacoes=[
            RankingObrigacoesItemOut(entidade=entidade, total_obrigacoes=total)
            for entidade, total in ranking_obrigacoes_dados
        ],
        ranking_valor_total=[
            RankingValorTotalItemOut(entidade=entidade, valor_total=valor)
            for entidade, valor in ranking_valor_dados
        ],
        divida_ativa=[
            DebitoDividaAtivaOut(
                entidade=entidade,
                ano_referencia=ano,
                tipo_debito=tipo,
                situacao_divida_ativa=situacao,
                valor_total=valor,
            )
            for entidade, ano, tipo, situacao, valor in divida_ativa_dados
        ],
        distribuicao_ano=[
            DistribuicaoAnoOut(ano_referencia=ano, quantidade=ano_qtd[ano], valor_total=ano_valor[ano])
            for ano in sorted(ano_qtd)
        ],
        distribuicao_tipo=[
            DistribuicaoTipoOut(tipo_debito=tipo, quantidade=tipo_qtd[tipo], valor_total=tipo_valor[tipo])
            for tipo in sorted(tipo_qtd, key=lambda tipo: (-tipo_qtd[tipo], tipo))
        ],
        distribuicao_situacao_pagamento=[
            DistribuicaoSituacaoPagamentoOut(
                situacao_pagamento=situacao,
                quantidade=situacao_qtd[situacao],
                valor_total=situacao_valor[situacao],
            )
            for situacao in sorted(situacao_qtd, key=lambda situacao: (-situacao_qtd[situacao], situacao))
        ],
        distribuicao_situacao_cadastral=[
            DistribuicaoSituacaoCadastralOut(
                situacao_registro=situacao,
                total_entidades=situacao_cadastral_total[situacao],
                total_com_debito_aberto=situacao_cadastral_aberto[situacao],
                total_sem_debito_aberto=situacao_cadastral_total[situacao] - situacao_cadastral_aberto[situacao],
            )
            for situacao in sorted(
                situacao_cadastral_total, key=lambda situacao: (-situacao_cadastral_total[situacao], situacao)
            )
        ],
        serie_historica_xlsx=_serie_historica_xlsx(sessao),
    )
