import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useSearchParams } from "react-router-dom";

import { ApiError, type EntidadeResumo, listarSnapshots, obterPendencias } from "@/api/client";
import { SnapshotPicker } from "@/components/SnapshotPicker";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatarNumero } from "@/lib/format";
import { normalizarTexto } from "@/lib/normalizar";

import { EntidadeRow } from "./EntidadeRow";
import { ExportLinks } from "./ExportLinks";
import { NomeAmbiguoGroup } from "./NomeAmbiguoGroup";

const CHAVE_CSV = "csv_snapshot_id";
const CHAVE_XLSX = "xlsx_snapshot_id";

type Aba = "somente_csv" | "somente_xlsx" | "nomes_ambiguos";

function paramNumerico(params: URLSearchParams, chave: string): number | undefined {
  const valor = params.get(chave);
  if (!valor) return undefined;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : undefined;
}

export function PendenciasPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const csvSnapshotId = paramNumerico(searchParams, CHAVE_CSV);
  const xlsxSnapshotId = paramNumerico(searchParams, CHAVE_XLSX);
  const [aba, setAba] = useState<Aba>("somente_csv");
  const [busca, setBusca] = useState("");

  const snapshotsCsv = useQuery({ queryKey: ["snapshots", "csv"], queryFn: () => listarSnapshots("csv") });
  const snapshotsXlsx = useQuery({ queryKey: ["snapshots", "xlsx"], queryFn: () => listarSnapshots("xlsx") });
  const pendencias = useQuery({
    queryKey: ["pendencias", csvSnapshotId, xlsxSnapshotId],
    queryFn: () => obterPendencias({ csvSnapshotId, xlsxSnapshotId }),
  });

  function selecionarSnapshot(chave: typeof CHAVE_CSV | typeof CHAVE_XLSX, id: number) {
    const proximos = new URLSearchParams(searchParams);
    proximos.set(chave, String(id));
    setSearchParams(proximos, { replace: true });
  }

  const buscaNormalizada = normalizarTexto(busca.trim());

  const somenteCsvFiltrado = useMemo(
    () => pendencias.data?.somente_csv.filter((e) => normalizarTexto(e.nome_original).includes(buscaNormalizada)) ?? [],
    [pendencias.data, buscaNormalizada],
  );
  const somenteXlsxFiltrado = useMemo(
    () => pendencias.data?.somente_xlsx.filter((e) => normalizarTexto(e.nome_original).includes(buscaNormalizada)) ?? [],
    [pendencias.data, buscaNormalizada],
  );
  const ambiguosFiltrados = useMemo(
    () =>
      pendencias.data?.nomes_ambiguos.filter((g) => normalizarTexto(g.nome_normalizado).includes(buscaNormalizada)) ??
      [],
    [pendencias.data, buscaNormalizada],
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 border-b border-border pb-5">
        <h1 className="font-serif text-2xl font-bold tracking-tight">Pendências de pareamento</h1>
        <p className="text-sm text-muted-foreground">
          Nomes que não bateram exatamente entre CSV e XLSX neste par de snapshots. Revise um a um ou exporte a lista
          completa.
        </p>
        <div className="flex flex-wrap gap-4">
          <SnapshotPicker
            label="Snapshot CSV"
            snapshots={snapshotsCsv.data}
            valorSelecionado={csvSnapshotId ?? pendencias.data?.csv_snapshot_id}
            onSelecionar={(id) => selecionarSnapshot(CHAVE_CSV, id)}
          />
          <SnapshotPicker
            label="Snapshot XLSX"
            snapshots={snapshotsXlsx.data}
            valorSelecionado={xlsxSnapshotId ?? pendencias.data?.xlsx_snapshot_id}
            onSelecionar={(id) => selecionarSnapshot(CHAVE_XLSX, id)}
          />
        </div>
      </header>

      {pendencias.isError ? (
        <Alert variant="destructive" role="alert">
          {pendencias.error instanceof ApiError
            ? pendencias.error.message
            : "Não foi possível carregar as pendências."}
        </Alert>
      ) : null}

      {pendencias.isLoading ? <p className="text-sm text-muted-foreground">Carregando pendências…</p> : null}

      {pendencias.data ? (
        <Card>
          <Tabs value={aba} onValueChange={(valor) => setAba(valor as Aba)}>
            <div className="px-6 pt-4">
              <TabsList>
                <TabsTrigger value="somente_csv">
                  Somente no CSV ({formatarNumero(pendencias.data.somente_csv.length)})
                </TabsTrigger>
                <TabsTrigger value="somente_xlsx">
                  Somente no XLSX ({formatarNumero(pendencias.data.somente_xlsx.length)})
                </TabsTrigger>
                <TabsTrigger value="nomes_ambiguos">
                  Nomes ambíguos ({formatarNumero(pendencias.data.nomes_ambiguos.length)})
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
              <div className="relative w-full max-w-xs">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  value={busca}
                  onChange={(evento) => setBusca(evento.target.value)}
                  placeholder="Buscar por nome…"
                  className="pl-8"
                  aria-label="Buscar por nome"
                />
              </div>
              <ExportLinks
                csvSnapshotId={pendencias.data.csv_snapshot_id}
                xlsxSnapshotId={pendencias.data.xlsx_snapshot_id}
              />
            </div>

            <CardContent className="p-0">
              <TabsContent value="somente_csv">
                <ListaEntidades
                  itens={somenteCsvFiltrado}
                  vazio={
                    pendencias.data.somente_csv.length === 0
                      ? "Nenhum nome apareceu só no CSV neste par de snapshots."
                      : "Nenhum nome corresponde à busca."
                  }
                />
              </TabsContent>
              <TabsContent value="somente_xlsx">
                <ListaEntidades
                  itens={somenteXlsxFiltrado}
                  vazio={
                    pendencias.data.somente_xlsx.length === 0
                      ? "Nenhum nome apareceu só no XLSX neste par de snapshots."
                      : "Nenhum nome corresponde à busca."
                  }
                />
              </TabsContent>
              <TabsContent value="nomes_ambiguos">
                {ambiguosFiltrados.length === 0 ? (
                  <p className="px-6 pb-6 text-sm text-muted-foreground">
                    {pendencias.data.nomes_ambiguos.length === 0
                      ? "Nenhum nome ambíguo neste par de snapshots."
                      : "Nenhum nome corresponde à busca."}
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    {ambiguosFiltrados.map((grupo) => (
                      <NomeAmbiguoGroup key={grupo.nome_normalizado} grupo={grupo} />
                    ))}
                  </ul>
                )}
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      ) : null}
    </div>
  );
}

function ListaEntidades({ itens, vazio }: { itens: EntidadeResumo[]; vazio: string }) {
  if (itens.length === 0) {
    return <p className="px-6 pb-6 text-sm text-muted-foreground">{vazio}</p>;
  }
  return (
    <ul className="divide-y divide-border">
      {itens.map((entidade) => (
        <EntidadeRow key={entidade.observacao_id} entidade={entidade} />
      ))}
    </ul>
  );
}
