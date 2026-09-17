import type { ReactNode } from "react";
import { AlertOctagon } from "lucide-react";

import type { Dashboard } from "@/api/client";
import { formatarMoeda, formatarNumero } from "@/lib/format";

interface IndicadoresStripProps {
  indicadores: Dashboard["indicadores"];
}

/**
 * Tira de indicadores como uma linha de extrato: uma unica faixa com fios
 * (via `gap-px` + `bg-border`) separando cada numero, nao cartoes soltos com
 * sombra. Valores por extenso (nao abreviados: "R$ 2.437.190" e nao "R$ 2,4M")
 * - e uma ferramenta de fiscalizacao financeira, o total exato importa.
 */
export function IndicadoresStrip({ indicadores }: IndicadoresStripProps) {
  const itens: { rotulo: string; valor: string; extra?: ReactNode }[] = [
    {
      rotulo: "profissionais e empresas (XLSX)",
      valor: formatarNumero(indicadores.total_entidades_xlsx),
    },
    {
      rotulo: "obrigações distintas",
      valor: formatarNumero(indicadores.total_obrigacoes_distintas_xlsx),
    },
    {
      rotulo: "valor total devido",
      valor: formatarMoeda(indicadores.total_valor_total_xlsx),
    },
    {
      rotulo: "parcelas em aberto (CSV)",
      valor: formatarNumero(indicadores.total_parcelas_em_aberto_csv),
    },
    {
      rotulo: "débitos em dívida ativa",
      valor: formatarNumero(indicadores.total_debitos_divida_ativa),
      extra:
        indicadores.total_debitos_divida_ativa_executiva > 0 ? (
          <span className="mt-1 inline-flex w-fit items-center gap-1 text-xs font-medium text-destructive">
            <AlertOctagon className="h-3 w-3" aria-hidden />
            {formatarNumero(indicadores.total_debitos_divida_ativa_executiva)} em fase executiva
          </span>
        ) : null,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3 lg:grid-cols-5">
      {itens.map((item) => (
        <div key={item.rotulo} className="flex flex-col gap-1 bg-card p-4">
          <span className="text-2xl font-semibold tracking-tight text-foreground">{item.valor}</span>
          <span className="text-sm text-muted-foreground">{item.rotulo}</span>
          {item.extra}
        </div>
      ))}
    </div>
  );
}
