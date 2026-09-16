import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DistribuicaoSituacaoCadastral } from "../api/types";

interface SituacaoCadastralChartProps {
  dados: DistribuicaoSituacaoCadastral[];
}

export function SituacaoCadastralChart({ dados }: SituacaoCadastralChartProps) {
  return (
    <div className="cartao">
      <h3>Situação cadastral x débito em aberto</h3>
      {dados.length === 0 ? (
        <p className="estado-vazio">Nenhum dado disponível.</p>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={dados} margin={{ left: 0, right: 8, top: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="situacao_registro" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Legend />
            <Bar dataKey="total_com_debito_aberto" name="Com débito em aberto" fill="#b42318" />
            <Bar dataKey="total_sem_debito_aberto" name="Sem débito em aberto" fill="#1a7f37" />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
