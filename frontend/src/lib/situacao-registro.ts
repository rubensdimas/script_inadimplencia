/**
 * Situacoes cadastrais em que a entidade ja encerrou o registro no conselho.
 * Usado para marcar com destaque quando uma dessas situacoes aparece junto de
 * um debito em aberto (Dashboard) ou de uma pendencia de pareamento
 * (Pendencias) - ex.: profissional BAIXADO que ainda tem divida pendente.
 */
const SITUACOES_DE_ATENCAO = new Set(["BAIXADO", "TRANSFERIDO", "CANCELADO", "SUSPENSO"]);

export function ehSituacaoDeAtencao(situacaoRegistro: string | null | undefined): boolean {
  if (!situacaoRegistro) return false;
  return SITUACOES_DE_ATENCAO.has(situacaoRegistro.toUpperCase());
}

/**
 * Situacoes cadastrais reais observadas nos dados de producao do CREFITO11
 * (nao ha endpoint que liste os valores distintos). Usado para popular o
 * filtro da busca de entidades; uma situacao fora desta lista continua
 * aparecendo normalmente nos resultados, so nao tem atalho no filtro.
 */
export const SITUACOES_REGISTRO_CONHECIDAS = [
  "ATIVO",
  "BAIXADO",
  "TRANSFERIDO",
  "CANCELADO",
  "SUSPENSO",
  "PROCESSO DE INSCRIÇÃO",
  "VENCIDO",
  "REQUERIMENTO POR TRANSFERÊNCIA",
  "INDEVIDO",
];
