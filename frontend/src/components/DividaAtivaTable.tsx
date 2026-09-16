import type { DebitoDividaAtiva } from "../api/types";
import { formatarMoeda } from "../utils/format";

interface DividaAtivaTableProps {
  itens: DebitoDividaAtiva[];
}

export function DividaAtivaTable({ itens }: DividaAtivaTableProps) {
  if (itens.length === 0) {
    return <p className="estado-vazio">Nenhum débito em dívida ativa no snapshot selecionado.</p>;
  }

  return (
    <div className="tabela-wrapper">
      <table>
        <thead>
          <tr>
            <th>Entidade</th>
            <th>Ano</th>
            <th>Tipo</th>
            <th>Situação</th>
            <th>Valor total</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((item, indice) => (
            <tr key={`${item.entidade.observacao_id}-${item.ano_referencia}-${item.tipo_debito}-${indice}`}>
              <td>{item.entidade.nome_original}</td>
              <td>{item.ano_referencia}</td>
              <td>{item.tipo_debito}</td>
              <td>{item.situacao_divida_ativa}</td>
              <td>{formatarMoeda(item.valor_total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
