from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class SnapshotOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    tipo_arquivo: str
    nome_arquivo_original: str
    data_snapshot: datetime
    data_upload: datetime
    linhas_invalidas: list[str] = []


class EntidadeResumoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int | None = Field(validation_alias="entidade_id")
    observacao_id: int
    nome_normalizado: str
    nome_original: str
    cpf_cnpj: str | None = Field(validation_alias="cpf_cnpj_mascarado")
    tipo_pessoa: str | None
    registro_resumido: str | None
    categoria: str | None
    subregiao: str | None
    situacao_registro: str | None


class DebitoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    origem: str
    ano_referencia: int
    tipo_debito: str
    numero_parcela: int | None
    data_vencimento: date | None
    valor_original: float | None
    valor_devido: float | None
    valor_total: float | None
    situacao_pagamento: str | None
    situacao_divida_ativa: str | None
    situacao_parcelamento: str | None
    entidade: EntidadeResumoOut = Field(validation_alias="observacao")


class PaginaDebitosOut(BaseModel):
    items: list[DebitoOut]
    total: int
    page: int
    page_size: int
    pages: int


# --- Busca e historico de entidades canonicas ------------------------------


class PaginaEntidadesOut(BaseModel):
    items: list[EntidadeResumoOut]
    total: int
    page: int
    page_size: int
    pages: int


class ObservacaoHistoricoOut(BaseModel):
    snapshot_id: int
    tipo_arquivo: str
    data_snapshot: datetime
    observacao_id: int
    nome_original: str
    nome_normalizado: str
    cpf_cnpj: str | None
    tipo_pessoa: str | None
    registro_resumido: str | None
    categoria: str | None
    subregiao: str | None
    situacao_registro: str | None


class DebitoHistoricoOut(BaseModel):
    id: int
    snapshot_id: int
    data_snapshot: datetime
    origem: str
    ano_referencia: int
    tipo_debito: str
    numero_parcela: int | None
    data_vencimento: date | None
    valor_original: Decimal | None
    valor_devido: Decimal | None
    valor_total: Decimal | None
    situacao_pagamento: str | None
    situacao_divida_ativa: str | None
    situacao_parcelamento: str | None


class EntidadeDetalheOut(BaseModel):
    entidade: EntidadeResumoOut
    observacoes: list[ObservacaoHistoricoOut]
    debitos: list[DebitoHistoricoOut]


# --- Comparacao (pareamento CSV x XLSX) ---------------------------------


class ResumoComparacaoOut(BaseModel):
    csv_snapshot_id: int
    xlsx_snapshot_id: int
    total_csv: int
    total_xlsx: int
    total_pareados: int
    total_somente_csv: int
    total_somente_xlsx: int
    total_nomes_ambiguos: int
    total_obrigacoes_somente_csv: int
    total_obrigacoes_somente_xlsx: int
    total_conflitos_parcelamento: int


class ObrigacaoExclusivaOut(BaseModel):
    entidade: EntidadeResumoOut
    ano_referencia: int
    tipo_debito: str


class ConflitoParcelamentoOut(BaseModel):
    entidade: EntidadeResumoOut
    ano_referencia: int
    tipo_debito: str
    parcelado_csv: bool
    parcelado_xlsx: bool


class NomeAmbiguoOut(BaseModel):
    nome_normalizado: str
    nome_csv: EntidadeResumoOut
    candidatos_xlsx: list[EntidadeResumoOut]


class ComparacaoOut(BaseModel):
    resumo: ResumoComparacaoOut
    entidades_somente_csv: list[EntidadeResumoOut]
    entidades_somente_xlsx: list[EntidadeResumoOut]
    obrigacoes_somente_csv: list[ObrigacaoExclusivaOut]
    obrigacoes_somente_xlsx: list[ObrigacaoExclusivaOut]
    conflitos_parcelamento: list[ConflitoParcelamentoOut]
    nomes_ambiguos: list[NomeAmbiguoOut]


class PendenciasPareamentoOut(BaseModel):
    """Pendencias de pareamento (spec story 22): nomes que nao bateram exatamente
    entre CSV e XLSX no par de snapshots selecionado, para revisao manual."""

    csv_snapshot_id: int
    xlsx_snapshot_id: int
    somente_csv: list[EntidadeResumoOut]
    somente_xlsx: list[EntidadeResumoOut]
    nomes_ambiguos: list[NomeAmbiguoOut]


# --- Dashboard analitico --------------------------------------------------


class IndicadoresDashboardOut(BaseModel):
    csv_snapshot_id: int
    xlsx_snapshot_id: int
    total_entidades_xlsx: int
    total_obrigacoes_distintas_xlsx: int
    total_valor_total_xlsx: Decimal
    total_parcelas_em_aberto_csv: int
    total_debitos_divida_ativa: int
    total_debitos_divida_ativa_executiva: int


class RankingObrigacoesItemOut(BaseModel):
    entidade: EntidadeResumoOut
    total_obrigacoes: int


class RankingValorTotalItemOut(BaseModel):
    entidade: EntidadeResumoOut
    valor_total: Decimal


class DebitoDividaAtivaOut(BaseModel):
    entidade: EntidadeResumoOut
    ano_referencia: int
    tipo_debito: str
    situacao_divida_ativa: str
    valor_total: Decimal | None


class DistribuicaoAnoOut(BaseModel):
    ano_referencia: int
    quantidade: int
    valor_total: Decimal


class DistribuicaoTipoOut(BaseModel):
    tipo_debito: str
    quantidade: int
    valor_total: Decimal


class DistribuicaoSituacaoPagamentoOut(BaseModel):
    situacao_pagamento: str
    quantidade: int
    valor_total: Decimal


class DistribuicaoSituacaoCadastralOut(BaseModel):
    """Situacao cadastral (ObservacaoEntidade.situacao_registro) cruzada com a existencia de
    debito em aberto no snapshot XLSX escolhido -- ex.: profissionais BAIXADOS que ainda
    possuem divida pendente (spec story 18)."""

    situacao_registro: str
    total_entidades: int
    total_com_debito_aberto: int
    total_sem_debito_aberto: int


class PontoSerieHistoricaOut(BaseModel):
    snapshot_id: int
    data_snapshot: datetime
    total_entidades: int
    total_valor_total: Decimal
    total_divida_ativa: int


class DashboardOut(BaseModel):
    indicadores: IndicadoresDashboardOut
    ranking_obrigacoes: list[RankingObrigacoesItemOut]
    ranking_valor_total: list[RankingValorTotalItemOut]
    divida_ativa: list[DebitoDividaAtivaOut]
    distribuicao_ano: list[DistribuicaoAnoOut]
    distribuicao_tipo: list[DistribuicaoTipoOut]
    distribuicao_situacao_pagamento: list[DistribuicaoSituacaoPagamentoOut]
    distribuicao_situacao_cadastral: list[DistribuicaoSituacaoCadastralOut]
    serie_historica_xlsx: list[PontoSerieHistoricaOut]
