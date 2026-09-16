import { Link } from "react-router-dom";
import type { EntidadeResumo } from "../api/types";

interface EntidadesTableProps {
  itens: EntidadeResumo[];
}

export function EntidadesTable({ itens }: EntidadesTableProps) {
  if (itens.length === 0) {
    return <p className="estado-vazio">Nenhuma entidade encontrada para os filtros informados.</p>;
  }

  return (
    <div className="tabela-wrapper">
      <table>
        <thead>
          <tr>
            <th>Nome</th>
            <th>Documento</th>
            <th>Tipo</th>
            <th>Categoria</th>
            <th>Subregião</th>
            <th>Situação cadastral</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((item) => (
            <tr key={item.observacao_id}>
              <td>
                {item.id !== null ? (
                  <Link to={`/entidades/${item.id}`}>{item.nome_original}</Link>
                ) : (
                  item.nome_original
                )}
              </td>
              <td>{item.cpf_cnpj ?? "—"}</td>
              <td>{item.tipo_pessoa ?? "—"}</td>
              <td>{item.categoria ?? "—"}</td>
              <td>{item.subregiao ?? "—"}</td>
              <td>{item.situacao_registro ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
