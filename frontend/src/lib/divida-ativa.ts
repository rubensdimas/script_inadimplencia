/**
 * Mesma regra do backend (`_em_divida_ativa` em services/analytics.py): so
 * "Administrativa" e "Executiva" contam como divida ativa de verdade. O
 * campo `situacao_divida_ativa` tambem carrega valores como "Nao lancado"
 * quando o debito nunca entrou em cobranca — isso NAO e uma situacao grave,
 * e o oposto: e o caso comum, sem cobranca judicial/administrativa aberta.
 */
const SITUACOES_DIVIDA_ATIVA = new Set(["ADMINISTRATIVA", "EXECUTIVA"]);

export function ehDividaAtiva(situacao: string | null | undefined): boolean {
  if (!situacao) return false;
  return SITUACOES_DIVIDA_ATIVA.has(situacao.toUpperCase());
}
