const formatadorDataHora = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

/** Formata um timestamp ISO (UTC) da API para `dd/mm/aaaa hh:mm` no fuso local. */
export function formatarDataHora(isoDatetime: string): string {
  return formatadorDataHora.format(new Date(isoDatetime));
}
