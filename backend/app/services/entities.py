"""Busca, filtro e historico de entidades canonicas.

`Entidade` so existe para pessoas/empresas identificadas por CPF/CNPJ no XLSX
(ver constraint global: "CSV permanece sem vinculo canonico permanente"). Por
isso a busca e o historico deste modulo cobrem apenas o universo XLSX -- uma
pessoa que so aparece no CSV nao tem `id` estavel para navegar entre
snapshots e fica fora de escopo aqui (ver comparisons/matching-issues para
essas pendencias).

Cada `Entidade` pode ter varias `ObservacaoEntidade` (uma por snapshot em que
apareceu). A busca e os filtros usam a observacao mais recente -- mesma
convencao de "mais recente" usada em `resolver_snapshot` (data_upload desc,
id desc) -- porque dados cadastrais sao observacoes imutaveis por snapshot, e
a tela de busca mostra o retrato cadastral atual de cada entidade.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models import Debito, Entidade, ObservacaoEntidade
from app.normalize import normalize_nome
from app.schemas import (
    DebitoHistoricoOut,
    EntidadeDetalheOut,
    EntidadeResumoOut,
    ObservacaoHistoricoOut,
    PaginaEntidadesOut,
)


def _chave_recencia_snapshot(observacao: ObservacaoEntidade) -> tuple:
    return (observacao.snapshot.data_upload, observacao.snapshot.id)


def _observacao_mais_recente(entidade: Entidade) -> ObservacaoEntidade:
    return max(entidade.observacoes, key=_chave_recencia_snapshot)


def _carregar_entidades_com_observacoes(sessao: Session) -> list[Entidade]:
    return list(
        sessao.scalars(
            select(Entidade).options(
                joinedload(Entidade.observacoes).joinedload(ObservacaoEntidade.snapshot)
            )
        )
        .unique()
        .all()
    )


def listar_entidades_filtradas(
    sessao: Session,
    *,
    query: str | None = None,
    tipo_pessoa: str | None = None,
    situacao_registro: str | None = None,
) -> list[ObservacaoEntidade]:
    """Observacao mais recente de cada `Entidade` que atende aos filtros.

    Usado tanto pela busca paginada (`buscar_entidades`) quanto pela
    exportacao do dataset `entities`, para nao duplicar a logica de filtro.
    """
    termo_normalizado = normalize_nome(query) if query and query.strip() else None
    tipo_filtro = tipo_pessoa.strip().upper() if tipo_pessoa and tipo_pessoa.strip() else None
    situacao_filtro = (
        situacao_registro.strip().upper() if situacao_registro and situacao_registro.strip() else None
    )

    resultado: list[ObservacaoEntidade] = []
    for entidade in _carregar_entidades_com_observacoes(sessao):
        if not entidade.observacoes:
            continue
        atual = _observacao_mais_recente(entidade)

        if termo_normalizado and termo_normalizado not in atual.nome_normalizado:
            continue
        if tipo_filtro and (atual.tipo_pessoa or "").strip().upper() != tipo_filtro:
            continue
        if situacao_filtro and (atual.situacao_registro or "").strip().upper() != situacao_filtro:
            continue
        resultado.append(atual)

    resultado.sort(key=lambda observacao: (observacao.nome_normalizado, observacao.entidade_id))
    return resultado


def buscar_entidades(
    sessao: Session,
    *,
    query: str | None,
    tipo_pessoa: str | None,
    situacao_registro: str | None,
    page: int,
    page_size: int,
) -> PaginaEntidadesOut:
    observacoes = listar_entidades_filtradas(
        sessao, query=query, tipo_pessoa=tipo_pessoa, situacao_registro=situacao_registro
    )
    total = len(observacoes)
    inicio = (page - 1) * page_size
    pagina = observacoes[inicio : inicio + page_size]
    return PaginaEntidadesOut(
        items=[EntidadeResumoOut.model_validate(observacao) for observacao in pagina],
        total=total,
        page=page,
        page_size=page_size,
        pages=(total + page_size - 1) // page_size,
    )


def _observacao_historico_out(observacao: ObservacaoEntidade) -> ObservacaoHistoricoOut:
    return ObservacaoHistoricoOut(
        snapshot_id=observacao.snapshot_id,
        tipo_arquivo=observacao.snapshot.tipo_arquivo,
        data_snapshot=observacao.snapshot.data_snapshot,
        observacao_id=observacao.id,
        nome_original=observacao.nome_original,
        nome_normalizado=observacao.nome_normalizado,
        cpf_cnpj=observacao.cpf_cnpj_mascarado,
        tipo_pessoa=observacao.tipo_pessoa,
        registro_resumido=observacao.registro_resumido,
        categoria=observacao.categoria,
        subregiao=observacao.subregiao,
        situacao_registro=observacao.situacao_registro,
    )


def _debito_historico_out(debito: Debito) -> DebitoHistoricoOut:
    return DebitoHistoricoOut(
        id=debito.id,
        snapshot_id=debito.observacao.snapshot_id,
        data_snapshot=debito.observacao.snapshot.data_snapshot,
        origem=debito.origem,
        ano_referencia=debito.ano_referencia,
        tipo_debito=debito.tipo_debito,
        numero_parcela=debito.numero_parcela,
        data_vencimento=debito.data_vencimento,
        valor_original=debito.valor_original,
        valor_devido=debito.valor_devido,
        valor_total=debito.valor_total,
        situacao_pagamento=debito.situacao_pagamento,
        situacao_divida_ativa=debito.situacao_divida_ativa,
        situacao_parcelamento=debito.situacao_parcelamento,
    )


def obter_entidade_detalhe(sessao: Session, entidade_id: int) -> EntidadeDetalheOut | None:
    """Resumo mascarado (observacao mais recente) + historico completo por snapshot.

    Os debitos de uma entidade canonica sao sempre `origem="xlsx"`: CSV nunca
    se vincula a `Entidade` (ver constraint global), logo essa lista nunca
    contem debitos CSV -- comportamento esperado, nao uma lacuna.
    """
    entidade = sessao.scalar(
        select(Entidade)
        .where(Entidade.id == entidade_id)
        .options(joinedload(Entidade.observacoes).joinedload(ObservacaoEntidade.snapshot))
    )
    if entidade is None or not entidade.observacoes:
        return None

    observacoes_ordenadas = sorted(entidade.observacoes, key=_chave_recencia_snapshot)
    atual = observacoes_ordenadas[-1]

    debitos = sessao.scalars(
        select(Debito)
        .join(ObservacaoEntidade)
        .where(ObservacaoEntidade.entidade_id == entidade_id)
        .options(joinedload(Debito.observacao).joinedload(ObservacaoEntidade.snapshot))
    ).all()
    debitos_ordenados = sorted(
        debitos,
        key=lambda debito: (*_chave_recencia_snapshot(debito.observacao), debito.id),
    )

    return EntidadeDetalheOut(
        entidade=EntidadeResumoOut.model_validate(atual),
        observacoes=[_observacao_historico_out(o) for o in observacoes_ordenadas],
        debitos=[_debito_historico_out(d) for d in debitos_ordenados],
    )
