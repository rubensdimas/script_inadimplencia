import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatarMoeda, formatarNumero } from "../utils/format";

export interface ItemDistribuicao {
  rotulo: string;
  quantidade: number;
  valorTotal: number;
}

interface DistributionBarChartProps {
  titulo: string;
  dados: ItemDistribuicao[];
}

export function DistributionBarChart({ titulo, dados }: DistributionBarChartProps) {
  return (
    <div className="cartao">
      <h3>{titulo}</h3>
      {dados.length === 0 ? (
        <p className="estado-vazio">Nenhum dado disponível.</p>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={dados} margin={{ left: 0, right: 8, top: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="rotulo" />
            <YAxis allowDecimals={false} />
            <Tooltip formatter={(valor) => formatarNumero(Number(valor))} />
            <Bar dataKey="quantidade" name="Quantidade" fill="#1d4ed8" />
          </BarChart>
        </ResponsiveContainer>
      )}
      {dados.length > 0 && (
        <ul className="sr-only">
          {dados.map((item) => (
            <li key={item.rotulo}>
              {item.rotulo}: {formatarNumero(item.quantidade)} registros, {formatarMoeda(String(item.valorTotal))}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
