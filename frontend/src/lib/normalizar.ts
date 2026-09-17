/** Mesma normalizacao de nome usada no backend: maiusculo, sem acentuacao. */
export function normalizarTexto(texto: string): string {
  return texto
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}
