import { apiFetch } from "./client";
import type { EntidadeDetalheOut, PaginaEntidadesOut } from "./types";

export interface ParametrosBuscaEntidades {
  query?: string;
  tipoPessoa?: string;
  situacaoRegistro?: string;
  page?: number;
  pageSize?: number;
}

export function buscarEntidades(params: ParametrosBuscaEntidades = {}): Promise<PaginaEntidadesOut> {
  const busca = new URLSearchParams();
  if (params.query) {
    busca.set("query", params.query);
  }
  if (params.tipoPessoa) {
    busca.set("tipo_pessoa", params.tipoPessoa);
  }
  if (params.situacaoRegistro) {
    busca.set("situacao_registro", params.situacaoRegistro);
  }
  if (params.page !== undefined) {
    busca.set("page", String(params.page));
  }
  if (params.pageSize !== undefined) {
    busca.set("page_size", String(params.pageSize));
  }
  const query = busca.toString();
  return apiFetch<PaginaEntidadesOut>(`/api/entities${query ? `?${query}` : ""}`);
}

export function obterEntidadeDetalhe(entidadeId: number): Promise<EntidadeDetalheOut> {
  return apiFetch<EntidadeDetalheOut>(`/api/entities/${entidadeId}`);
}
