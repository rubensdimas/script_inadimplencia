import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useSearchParams } from "react-router-dom";

import { ApiError, buscarEntidades, urlExportacaoEntidades } from "@/api/client";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SITUACOES_REGISTRO_CONHECIDAS } from "@/lib/situacao-registro";

import { EntidadeListItem } from "./EntidadeListItem";
import { Paginacao } from "./Paginacao";

const PAGE_SIZE = 50;

export function EntidadesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("query") ?? "";
  const tipoPessoa = searchParams.get("tipo_pessoa") ?? "";
  const situacaoRegistro = searchParams.get("situacao_registro") ?? "";
  const page = Number(searchParams.get("page") ?? "1");

  const [textoBusca, setTextoBusca] = useState(query);

  // Debounce so no texto: filtros de select trocam a URL na hora.
  useEffect(() => {
    const handle = setTimeout(() => {
      if (textoBusca === query) return;
      const proximos = new URLSearchParams(searchParams);
      if (textoBusca) proximos.set("query", textoBusca);
      else proximos.delete("query");
      proximos.set("page", "1");
      setSearchParams(proximos, { replace: true });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textoBusca]);

  function atualizarFiltro(chave: "tipo_pessoa" | "situacao_registro", valor: string) {
    const proximos = new URLSearchParams(searchParams);
    if (valor) proximos.set(chave, valor);
    else proximos.delete(chave);
    proximos.set("page", "1");
    setSearchParams(proximos, { replace: true });
  }

  function mudarPagina(novaPagina: number) {
    const proximos = new URLSearchParams(searchParams);
    proximos.set("page", String(novaPagina));
    setSearchParams(proximos);
  }

  const resultado = useQuery({
    queryKey: ["entidades", query, tipoPessoa, situacaoRegistro, page],
    queryFn: () =>
      buscarEntidades({ query, tipoPessoa, situacaoRegistro, page, pageSize: PAGE_SIZE }),
  });

  const parametrosExportacao = { query, tipoPessoa, situacaoRegistro };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 border-b border-border pb-5">
        <h1 className="font-serif text-2xl font-bold tracking-tight">Entidades</h1>
        <p className="text-sm text-muted-foreground">
          Busque profissionais e empresas por nome e veja o histórico cadastral e de débitos de cada um.
        </p>
      </header>

      <Card>
        {/*
          Grid com coluna base explicita (nao flex-wrap com min-width
          misturado a flex-1): cada campo ocupa a largura toda no mobile,
          sem depender de como o navegador decide quebrar linha. Ver
          docs/DESIGN.md sobre declarar sempre a coluna base de um grid
          responsivo.
        */}
        <div className="grid grid-cols-1 gap-3 px-6 pt-4 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto] lg:items-end">
          <div className="relative min-w-0">
            <label htmlFor="busca-entidades" className="mb-1 block text-sm text-muted-foreground">
              Nome
            </label>
            <Search
              className="pointer-events-none absolute left-2.5 top-[calc(50%+0.5rem)] h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="busca-entidades"
              value={textoBusca}
              onChange={(evento) => setTextoBusca(evento.target.value)}
              placeholder="Buscar por nome…"
              className="pl-8"
            />
          </div>
          <label className="flex min-w-0 flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Tipo de pessoa</span>
            <Select
              value={tipoPessoa}
              onChange={(evento) => atualizarFiltro("tipo_pessoa", evento.target.value)}
              className="lg:w-40"
            >
              <option value="">Todos</option>
              <option value="Profissional">Profissional</option>
              <option value="Empresa">Empresa</option>
            </Select>
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Situação cadastral</span>
            <Select
              value={situacaoRegistro}
              onChange={(evento) => atualizarFiltro("situacao_registro", evento.target.value)}
              className="lg:w-48"
            >
              <option value="">Todas</option>
              {SITUACOES_REGISTRO_CONHECIDAS.map((situacao) => (
                <option key={situacao} value={situacao}>
                  {situacao}
                </option>
              ))}
            </Select>
          </label>
          <div className="flex min-w-0 items-center gap-3 pb-2 text-sm">
            <span className="text-muted-foreground">Exportar:</span>
            <a
              href={urlExportacaoEntidades("csv", parametrosExportacao)}
              className="font-medium text-primary hover:underline"
            >
              CSV
            </a>
            <a
              href={urlExportacaoEntidades("xlsx", parametrosExportacao)}
              className="font-medium text-primary hover:underline"
            >
              Excel
            </a>
          </div>
        </div>

        <CardContent className="p-0">
          <div className="px-6 pt-4">
            {resultado.isError ? (
              <Alert variant="destructive" role="alert" className="mb-4">
                {resultado.error instanceof ApiError
                  ? resultado.error.message
                  : "Não foi possível carregar as entidades."}
              </Alert>
            ) : null}
          </div>

          {resultado.isLoading ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">Carregando…</p>
          ) : resultado.data && resultado.data.items.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">
              Nenhuma entidade encontrada com esses filtros.
            </p>
          ) : resultado.data ? (
            <ul className="divide-y divide-border">
              {resultado.data.items.map((entidade) => (
                <EntidadeListItem key={entidade.observacao_id} entidade={entidade} />
              ))}
            </ul>
          ) : null}

          {resultado.data ? (
            <Paginacao
              page={resultado.data.page}
              pages={resultado.data.pages}
              total={resultado.data.total}
              onMudarPagina={mudarPagina}
            />
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
