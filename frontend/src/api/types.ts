// Tipos espelhando os schemas Pydantic do backend (backend/app/schemas.py).
// Campos monetarios/Decimal sao serializados pelo backend como string JSON
// (ex.: "12345.67"); nunca tratar como numero sem passar por Number()/parseFloat.

export type TipoArquivo = "csv" | "xlsx";

export interface SnapshotOut {
  id: number;
  tipo_arquivo: TipoArquivo;
  nome_arquivo_original: string;
  data_snapshot: string;
  data_upload: string;
}

export interface EntidadeResumo {
  id: number | null;
  observacao_id: number;
  nome_normalizado: string;
  nome_original: string;
  cpf_cnpj: string | null;
  tipo_pessoa: string | null;
  registro_resumido: string | null;
  categoria: string | null;
  subregiao: string | null;
  situacao_registro: string | null;
}

export interface IndicadoresDashboard {
  csv_snapshot_id: number;
  xlsx_snapshot_id: number;
  total_entidades_xlsx: number;
  total_obrigacoes_distintas_xlsx: number;
  total_valor_total_xlsx: string;
  total_parcelas_em_aberto_csv: number;
  total_debitos_divida_ativa: number;
  total_debitos_divida_ativa_executiva: number;
}

export interface RankingObrigacoesItem {
  entidade: EntidadeResumo;
  total_obrigacoes: number;
}

export interface RankingValorTotalItem {
  entidade: EntidadeResumo;
  valor_total: string;
}

export interface DebitoDividaAtiva {
  entidade: EntidadeResumo;
  ano_referencia: number;
  tipo_debito: string;
  situacao_divida_ativa: string;
  valor_total: string | null;
}

export interface DistribuicaoAno {
  ano_referencia: number;
  quantidade: number;
  valor_total: string;
}

export interface DistribuicaoTipo {
  tipo_debito: string;
  quantidade: number;
  valor_total: string;
}

export interface DistribuicaoSituacaoPagamento {
  situacao_pagamento: string;
  quantidade: number;
  valor_total: string;
}

export interface DistribuicaoSituacaoCadastral {
  situacao_registro: string;
  total_entidades: number;
  total_com_debito_aberto: number;
  total_sem_debito_aberto: number;
}

export interface PontoSerieHistorica {
  snapshot_id: number;
  data_snapshot: string;
  total_entidades: number;
  total_valor_total: string;
  total_divida_ativa: number;
}

export interface PaginaEntidadesOut {
  items: EntidadeResumo[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface ObservacaoHistorico {
  snapshot_id: number;
  tipo_arquivo: TipoArquivo;
  data_snapshot: string;
  observacao_id: number;
  nome_original: string;
  nome_normalizado: string;
  cpf_cnpj: string | null;
  tipo_pessoa: string | null;
  registro_resumido: string | null;
  categoria: string | null;
  subregiao: string | null;
  situacao_registro: string | null;
}

export interface DebitoHistorico {
  id: number;
  snapshot_id: number;
  data_snapshot: string;
  origem: TipoArquivo;
  ano_referencia: number;
  tipo_debito: string;
  numero_parcela: number | null;
  data_vencimento: string | null;
  valor_original: string | null;
  valor_devido: string | null;
  valor_total: string | null;
  situacao_pagamento: string | null;
  situacao_divida_ativa: string | null;
  situacao_parcelamento: string | null;
}

export interface EntidadeDetalheOut {
  entidade: EntidadeResumo;
  observacoes: ObservacaoHistorico[];
  debitos: DebitoHistorico[];
}

export interface NomeAmbiguo {
  nome_normalizado: string;
  nome_csv: EntidadeResumo;
  candidatos_xlsx: EntidadeResumo[];
}

export interface PendenciasPareamentoOut {
  csv_snapshot_id: number;
  xlsx_snapshot_id: number;
  somente_csv: EntidadeResumo[];
  somente_xlsx: EntidadeResumo[];
  nomes_ambiguos: NomeAmbiguo[];
}

export interface DashboardOut {
  indicadores: IndicadoresDashboard;
  ranking_obrigacoes: RankingObrigacoesItem[];
  ranking_valor_total: RankingValorTotalItem[];
  divida_ativa: DebitoDividaAtiva[];
  distribuicao_ano: DistribuicaoAno[];
  distribuicao_tipo: DistribuicaoTipo[];
  distribuicao_situacao_pagamento: DistribuicaoSituacaoPagamento[];
  distribuicao_situacao_cadastral: DistribuicaoSituacaoCadastral[];
  serie_historica_xlsx: PontoSerieHistorica[];
}
