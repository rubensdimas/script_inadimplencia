import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { Dashboard } from "@/api/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatarData, formatarMoeda, formatarNumero } from "@/lib/format";

import { CHART_TOKENS, ChartTooltip } from "./chart-utils";

interface SerieHistoricaChartProps {
  pontos: Dashboard["serie_historica_xlsx"];
}

const EIXO_X = {
  dataKey: "data_snapshot",
  tickFormatter: (valor: string) => formatarData(valor),
  tick: { fill: CHART_TOKENS.axis, fontSize: 11 },
  tickLine: false,
  axisLine: { stroke: CHART_TOKENS.grid },
};

/**
 * Tres pequenos multiplos, um por metrica - nao um unico grafico com tres
 * eixos y (escalas incompativeis: entidades ~milhares, valor ~milhoes,
 * divida ativa ~dezenas). Cada um e serie unica, sem legenda propria (o
 * titulo do cartao ja diz o que e).
 */
export function SerieHistoricaChart({ pontos }: SerieHistoricaChartProps) {
  if (pontos.length < 2) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Evolução entre snapshots</CardTitle>
          <CardDescription>É preciso pelo menos dois snapshots XLSX para traçar uma evolução.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Evolução entre snapshots</CardTitle>
        <CardDescription>Como os indicadores mudaram ao longo dos envios do XLSX.</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <MiniSerie
          titulo="Profissionais e empresas"
          pontos={pontos}
          chave="total_entidades"
          formatarValor={(v) => formatarNumero(v)}
        />
        <MiniSerie
          titulo="Valor total devido"
          pontos={pontos}
          chave="total_valor_total"
          formatarValor={(v) => formatarMoeda(v)}
        />
        <MiniSerie
          titulo="Débitos em dívida ativa"
          pontos={pontos}
          chave="total_divida_ativa"
          formatarValor={(v) => formatarNumero(v)}
        />
      </CardContent>
    </Card>
  );
}

interface MiniSerieProps {
  titulo: string;
  pontos: Dashboard["serie_historica_xlsx"];
  chave: "total_entidades" | "total_valor_total" | "total_divida_ativa";
  formatarValor: (valor: number) => string;
}

function MiniSerie({ titulo, pontos, chave, formatarValor }: MiniSerieProps) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-foreground">{titulo}</p>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={pontos} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`fill-${chave}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_TOKENS.brand} stopOpacity={0.1} />
                <stop offset="100%" stopColor={CHART_TOKENS.brand} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={CHART_TOKENS.grid} />
            <XAxis {...EIXO_X} />
            <YAxis
              width={52}
              tick={{ fill: CHART_TOKENS.axis, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip
              content={({ active, label, payload }) => (
                <ChartTooltip active={active} label={label ? formatarData(String(label)) : undefined}>
                  {payload?.[0] ? <p>{formatarValor(Number(payload[0].value))}</p> : null}
                </ChartTooltip>
              )}
            />
            <Area
              dataKey={chave}
              stroke={CHART_TOKENS.brand}
              strokeWidth={2}
              fill={`url(#fill-${chave})`}
              dot={{ r: 4, fill: CHART_TOKENS.brand, stroke: "hsl(var(--card))", strokeWidth: 2 }}
              activeDot={{ r: 5, fill: CHART_TOKENS.brand, stroke: "hsl(var(--card))", strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
