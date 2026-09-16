import { useId, useState, type FormEvent } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { buscarEntidades } from "../api/entities";
import { ApiError } from "../api/client";
import { EntidadesTable } from "../components/EntidadesTable";
import { Paginacao } from "../components/Paginacao";
import { ExportButtons } from "../components/ExportButtons";

const TAMANHO_PAGINA = 20;

interface FiltrosEntidades {
  query: string;
  tipoPessoa: string;
  situacaoRegistro: string;
}

const FILTROS_VAZIOS: FiltrosEntidades = { query: "", tipoPessoa: "", situacaoRegistro: "" };

export function EntidadesPage() {
  const idQuery = useId();
  const idTipoPessoa = useId();
  const idSituacaoRegistro = useId();

  const [rascunho, setRascunho] = useState<FiltrosEntidades>(FILTROS_VAZIOS);
  const [filtros, setFiltros] = useState<FiltrosEntidades>(FILTROS_VAZIOS);
  const [page, setPage] = useState(1);

  const entidades = useQuery({
    queryKey: ["entidades", filtros.query, filtros.tipoPessoa, filtros.situacaoRegistro, page],
    queryFn: () =>
      buscarEntidades({
        query: filtros.query || undefined,
        tipoPessoa: filtros.tipoPessoa || undefined,
        situacaoRegistro: filtros.situacaoRegistro || undefined,
        page,
        pageSize: TAMANHO_PAGINA,
      }),
    placeholderData: keepPreviousData,
  });

  function aoSubmeterFiltros(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setFiltros(rascunho);
    setPage(1);
  }

  return (
    <div>
      <div className="pagina-cabecalho">
        <h2>Entidades</h2>
        <p>Busque profissionais e empresas cadastrados e veja o histórico entre snapshots.</p>
      </div>

      <form
        className="formulario-filtros"
        role="search"
        aria-label="Buscar entidades"
        onSubmit={aoSubmeterFiltros}
      >
        <div className="campo-selecionador">
          <label htmlFor={idQuery}>Nome</label>
          <input
            id={idQuery}
            type="text"
            placeholder="Buscar por nome"
            value={rascunho.query}
            onChange={(evento) => setRascunho({ ...rascunho, query: evento.target.value })}
          />
        </div>
        <div className="campo-selecionador">
          <label htmlFor={idTipoPessoa}>Tipo de pessoa</label>
          <select
            id={idTipoPessoa}
            value={rascunho.tipoPessoa}
            onChange={(evento) => setRascunho({ ...rascunho, tipoPessoa: evento.target.value })}
          >
            <option value="">Todos</option>
            <option value="Profissional">Profissional</option>
            <option value="Empresa">Empresa</option>
          </select>
        </div>
        <div className="campo-selecionador">
          <label htmlFor={idSituacaoRegistro}>Situação cadastral</label>
          <input
            id={idSituacaoRegistro}
            type="text"
            placeholder="ex.: ATIVO"
            value={rascunho.situacaoRegistro}
            onChange={(evento) => setRascunho({ ...rascunho, situacaoRegistro: evento.target.value })}
          />
        </div>
        <button type="submit">Buscar</button>
      </form>

      <ExportButtons
        dataset="entities"
        rotulo="Exportar resultados"
        parametros={{
          query: filtros.query || undefined,
          tipo_pessoa: filtros.tipoPessoa || undefined,
          situacao_registro: filtros.situacaoRegistro || undefined,
        }}
      />

      {entidades.isLoading && (
        <p className="estado-carregando" role="status">
          Carregando entidades...
        </p>
      )}

      {entidades.isError && (
        <p className="mensagem-erro" role="alert">
          {entidades.error instanceof ApiError
            ? entidades.error.message
            : "Falha inesperada ao buscar entidades."}
        </p>
      )}

      {entidades.data && (
        <section className="secao">
          <EntidadesTable itens={entidades.data.items} />
          <Paginacao pagina={entidades.data.page} totalPaginas={entidades.data.pages} aoAlterarPagina={setPage} />
        </section>
      )}
    </div>
  );
}
