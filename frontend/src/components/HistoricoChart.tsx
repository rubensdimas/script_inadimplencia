import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { PontoSerieHistorica } from "../api/types";
import { formatarData, paraNumero } from "../utils/format";

interface HistoricoChartProps {
  dados: PontoSerieHistorica[];
}

export function HistoricoChart({ dados }: HistoricoChartProps) {
  const pontos = dados.map((ponto) => ({
    ...ponto,
    rotulo: formatarData(ponto.data_snapshot),
    total_valor_total_numero: paraNumero(ponto.total_valor_total),
  }));

  return (
    <div className="cartao">
      <h3>Evolução histórica (snapshots XLSX)</h3>
      {pontos.length === 0 ? (
        <p className="estado-vazio">Nenhum snapshot histórico disponível.</p>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={pontos} margin={{ left: 0, right: 8, top: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="rotulo" />
            <YAxis yAxisId="quantidade" allowDecimals={false} />
            <YAxis yAxisId="valor" orientation="right" allowDecimals={false} />
            <Tooltip />
            <Legend />
            <Line yAxisId="quantidade" type="monotone" dataKey="total_entidades" name="Entidades" stroke="#1d4ed8" />
            <Line yAxisId="quantidade" type="monotone" dataKey="total_divida_ativa" name="Dívida ativa" stroke="#b42318" />
            <Line
              yAxisId="valor"
              type="monotone"
              dataKey="total_valor_total_numero"
              name="Valor total"
              stroke="#1a7f37"
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
