// Exportacoes (backend/app/routers/exports.py): download simples via GET com
// Content-Disposition: attachment. Nao usamos apiFetch/blob aqui de proposito --
// a forma mais simples e correta e navegar/ancorar direto para a URL construida
// e deixar o navegador tratar o download a partir do header do backend.

export type DatasetExportacao = "ranking" | "comparisons" | "entities" | "matching-issues";
export type FormatoExportacao = "csv" | "xlsx";

export function montarUrlExportacao(
  dataset: DatasetExportacao,
  formato: FormatoExportacao,
  parametros: Record<string, string | number | undefined> = {},
): string {
  const busca = new URLSearchParams();
  busca.set("format", formato);
  for (const [chave, valor] of Object.entries(parametros)) {
    if (valor !== undefined && valor !== "") {
      busca.set(chave, String(valor));
    }
  }
  return `/api/exports/${dataset}?${busca.toString()}`;
}
