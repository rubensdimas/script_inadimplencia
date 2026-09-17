import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { Dashboard } from "@/api/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatarMoeda, formatarNumero } from "@/lib/format";

import { CHART_TOKENS, ChartTooltip, corTipoDebito } from "./chart-utils";

interface DistribuicoesRowProps {
  distribuicaoAno: Dashboard["distribuicao_ano"];
  distribuicaoTipo: Dashboard["distribuicao_tipo"];
  distribuicaoSituacaoPagamento: Dashboard["distribuicao_situacao_pagamento"];
}

const EIXO_COMUM = {
  tick: { fill: CHART_TOKENS.axis, fontSize: 12 },
  tickLine: false,
  axisLine: { stroke: CHART_TOKENS.grid },
};

export function DistribuicoesRow({
  distribuicaoAno,
  distribuicaoTipo,
  distribuicaoSituacaoPagamento,
}: DistribuicoesRowProps) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle>Por ano de referência</CardTitle>
          <CardDescription>Quantidade de débitos por ano.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={distribuicaoAno} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={CHART_TOKENS.grid} />
                <XAxis dataKey="ano_referencia" {...EIXO_COMUM} />
                <YAxis {...EIXO_COMUM} width={56} allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted))" }}
                  content={({ active, label, payload }) => (
                    <ChartTooltip active={active} label={String(label)}>
                      {payload?.[0] ? (
                        <>
                          <p>{formatarNumero(Number(payload[0].value))} débitos</p>
                          <p className="text-muted-foreground">
                            {formatarMoeda(payload[0].payload.valor_total as string)}
                          </p>
                        </>
                      ) : null}
                    </ChartTooltip>
                  )}
                />
                <Bar dataKey="quantidade" fill={CHART_TOKENS.brand} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Por tipo de débito</CardTitle>
          <CardDescription>Quantidade por tipo (cor fixa por identidade).</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={distribuicaoTipo}
                layout="vertical"
                margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
              >
                <CartesianGrid horizontal={false} stroke={CHART_TOKENS.grid} />
                <XAxis type="number" {...EIXO_COMUM} allowDecimals={false} />
                <YAxis
                  dataKey="tipo_debito"
                  type="category"
                  width={110}
                  tick={{ fill: CHART_TOKENS.axis, fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: CHART_TOKENS.grid }}
                />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted))" }}
                  content={({ active, label, payload }) => (
                    <ChartTooltip active={active} label={String(label)}>
                      {payload?.[0] ? (
                        <>
                          <p>{formatarNumero(Number(payload[0].value))} débitos</p>
                          <p className="text-muted-foreground">
                            {formatarMoeda(payload[0].payload.valor_total as string)}
                          </p>
                        </>
                      ) : null}
                    </ChartTooltip>
                  )}
                />
                <Bar dataKey="quantidade" radius={[0, 4, 4, 0]} maxBarSize={18} isAnimationActive={false}>
                  {distribuicaoTipo.map((item) => (
                    <Cell key={item.tipo_debito} fill={corTipoDebito(item.tipo_debito)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Por situação de pagamento</CardTitle>
          <CardDescription>Quantidade de débitos por status (XLSX).</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={distribuicaoSituacaoPagamento}
                layout="vertical"
                margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
              >
                <CartesianGrid horizontal={false} stroke={CHART_TOKENS.grid} />
                <XAxis type="number" {...EIXO_COMUM} allowDecimals={false} />
                <YAxis
                  dataKey="situacao_pagamento"
                  type="category"
                  width={110}
                  tick={{ fill: CHART_TOKENS.axis, fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: CHART_TOKENS.grid }}
                />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted))" }}
                  content={({ active, label, payload }) => (
                    <ChartTooltip active={active} label={String(label)}>
                      {payload?.[0] ? (
                        <>
                          <p>{formatarNumero(Number(payload[0].value))} débitos</p>
                          <p className="text-muted-foreground">
                            {formatarMoeda(payload[0].payload.valor_total as string)}
                          </p>
                        </>
                      ) : null}
                    </ChartTooltip>
                  )}
                />
                <Bar dataKey="quantidade" fill={CHART_TOKENS.brand} radius={[0, 4, 4, 0]} maxBarSize={18} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
