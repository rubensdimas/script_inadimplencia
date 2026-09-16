interface ItemRanking {
  chave: number | string;
  nome: string;
  detalhe: string | null;
  valor: string;
}

interface RankingListProps {
  titulo: string;
  rotuloValor: string;
  itens: ItemRanking[];
}

export function RankingList({ titulo, rotuloValor, itens }: RankingListProps) {
  return (
    <div className="cartao">
      <h3>{titulo}</h3>
      {itens.length === 0 ? (
        <p className="estado-vazio">Nenhum dado disponível.</p>
      ) : (
        <div className="tabela-wrapper">
          <table>
            <thead>
              <tr>
                <th>Entidade</th>
                <th>{rotuloValor}</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((item) => (
                <tr key={item.chave}>
                  <td>
                    {item.nome}
                    {item.detalhe ? <span> ({item.detalhe})</span> : null}
                  </td>
                  <td>{item.valor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
