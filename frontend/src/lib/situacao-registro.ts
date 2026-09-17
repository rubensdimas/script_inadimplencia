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
