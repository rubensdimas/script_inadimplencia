// Helpers de formatacao. Valores monetarios chegam da API como string (Decimal
// serializado pelo pydantic) e precisam ser convertidos antes de exibir ou
// usar em graficos -- nunca tratar como numero ja pronto.

export function paraNumero(valor: string | null | undefined): number {
  if (valor === null || valor === undefined) {
    return 0;
  }
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
}

const formatadorMoeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatarMoeda(valor: string | null | undefined): string {
  return formatadorMoeda.format(paraNumero(valor));
}

const formatadorNumero = new Intl.NumberFormat("pt-BR");

export function formatarNumero(valor: number): string {
  return formatadorNumero.format(valor);
}

const formatadorData = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export function formatarData(valorIso: string): string {
  const data = new Date(valorIso);
  if (Number.isNaN(data.getTime())) {
    return valorIso;
  }
  return formatadorData.format(data);
}
