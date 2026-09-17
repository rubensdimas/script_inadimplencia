const formatadorDataHora = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

const formatadorData = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

const formatadorMoeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const formatadorNumero = new Intl.NumberFormat("pt-BR");

/** Formata um timestamp ISO (UTC) da API para `dd/mm/aaaa hh:mm` no fuso local. */
export function formatarDataHora(isoDatetime: string): string {
  return formatadorDataHora.format(new Date(isoDatetime));
}

/** Formata um timestamp ISO (UTC) da API para `dd/mm/aaaa`, sem hora. */
export function formatarData(isoDatetime: string): string {
  return formatadorData.format(new Date(isoDatetime));
}

/**
 * Formata um valor monetario decimal (a API envia `Decimal` como string em
 * JSON) por extenso, sem abreviar. Ferramenta de fiscalizacao financeira: o
 * total exato importa mais do que a leitura rapida de um numero arredondado.
 */
export function formatarMoeda(valorDecimal: string | number): string {
  return formatadorMoeda.format(Number(valorDecimal));
}

/** Formata um inteiro com separador de milhar (`4212` -> `4.212`). */
export function formatarNumero(valor: number): string {
  return formatadorNumero.format(valor);
}
