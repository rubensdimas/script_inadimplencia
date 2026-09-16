import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { obterEntidadeDetalhe } from "../api/entities";
import { ApiError } from "../api/client";
import { formatarData, formatarMoeda } from "../utils/format";
import type { DebitoHistorico, ObservacaoHistorico } from "../api/types";

export function EntidadeDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const entidadeId = Number(id);

  const detalhe = useQuery({
    queryKey: ["entidade", entidadeId],
    queryFn: () => obterEntidadeDetalhe(entidadeId),
    enabled: Number.isFinite(entidadeId),
  });

  return (
    <div>
      <div className="pagina-cabecalho">
        <Link to="/entidades">&larr; Voltar para Entidades</Link>
        <h2>Detalhe da entidade</h2>
      </div>

      {detalhe.isLoading && (
        <p className="estado-carregando" role="status">
          Carregando entidade...
        </p>
      )}

      {detalhe.isError && (
        <p className="mensagem-erro" role="alert">
          {detalhe.error instanceof ApiError
            ? detalhe.error.message
            : "Falha inesperada ao carregar a entidade."}
        </p>
      )}

      {detalhe.data && (
        <>
          <section className="cartao cartao-entidade-detalhe">
            <h3>{detalhe.data.entidade.nome_original}</h3>
            <dl className="lista-definicoes">
              <div>
                <dt>Documento</dt>
                <dd>{detalhe.data.entidade.cpf_cnpj ?? "—"}</dd>
              </div>
              <div>
                <dt>Tipo</dt>
                <dd>{detalhe.data.entidade.tipo_pessoa ?? "—"}</dd>
              </div>
              <div>
                <dt>Categoria</dt>
                <dd>{detalhe.data.entidade.categoria ?? "—"}</dd>
              </div>
              <div>
                <dt>Subregião</dt>
                <dd>{detalhe.data.entidade.subregiao ?? "—"}</dd>
              </div>
              <div>
                <dt>Situação cadastral atual</dt>
                <dd>{detalhe.data.entidade.situacao_registro ?? "—"}</dd>
              </div>
              <div>
                <dt>Registro</dt>
                <dd>{detalhe.data.entidade.registro_resumido ?? "—"}</dd>
              </div>
            </dl>
          </section>

          <section className="secao">
            <h3>Histórico cadastral por snapshot</h3>
            <TabelaObservacoes itens={detalhe.data.observacoes} />
          </section>

          <section className="secao">
            <h3>Histórico de débitos por snapshot</h3>
            <TabelaDebitos itens={detalhe.data.debitos} />
          </section>
        </>
      )}
    </div>
  );
}

function TabelaObservacoes({ itens }: { itens: ObservacaoHistorico[] }) {
  if (itens.length === 0) {
    return <p className="estado-vazio">Nenhuma observação cadastral registrada.</p>;
  }
  return (
    <div className="tabela-wrapper">
      <table>
        <thead>
          <tr>
            <th>Snapshot</th>
            <th>Origem</th>
            <th>Situação cadastral</th>
            <th>Categoria</th>
            <th>Subregião</th>
            <th>Registro</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((observacao) => (
            <tr key={observacao.observacao_id}>
              <td>{formatarData(observacao.data_snapshot)}</td>
              <td>{observacao.tipo_arquivo.toUpperCase()}</td>
              <td>{observacao.situacao_registro ?? "—"}</td>
              <td>{observacao.categoria ?? "—"}</td>
              <td>{observacao.subregiao ?? "—"}</td>
              <td>{observacao.registro_resumido ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TabelaDebitos({ itens }: { itens: DebitoHistorico[] }) {
  if (itens.length === 0) {
    return <p className="estado-vazio">Nenhum débito registrado.</p>;
  }
  return (
    <div className="tabela-wrapper">
      <table>
        <thead>
          <tr>
            <th>Snapshot</th>
            <th>Origem</th>
            <th>Ano</th>
            <th>Tipo</th>
            <th>Vencimento</th>
            <th>Valor total</th>
            <th>Situação pagamento</th>
            <th>Dívida ativa</th>
            <th>Parcelamento</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((debito) => (
            <tr key={debito.id}>
              <td>{formatarData(debito.data_snapshot)}</td>
              <td>{debito.origem.toUpperCase()}</td>
              <td>{debito.ano_referencia}</td>
              <td>{debito.tipo_debito}</td>
              <td>{debito.data_vencimento ? formatarData(debito.data_vencimento) : "—"}</td>
              <td>{formatarMoeda(debito.valor_total)}</td>
              <td>{debito.situacao_pagamento ?? "—"}</td>
              <td>{debito.situacao_divida_ativa ?? "—"}</td>
              <td>{debito.situacao_parcelamento ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
