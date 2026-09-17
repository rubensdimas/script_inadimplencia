import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";

import { ApiError, listarSnapshots, obterDashboard } from "@/api/client";
import { Alert } from "@/components/ui/alert";
import { formatarMoeda, formatarNumero } from "@/lib/format";

import { DistribuicoesRow } from "./DistribuicoesRow";
import { DividaAtivaPanel } from "./DividaAtivaPanel";
import { IndicadoresStrip } from "./IndicadoresStrip";
import { RankingList } from "./RankingList";
import { SerieHistoricaChart } from "./SerieHistoricaChart";
import { SituacaoCadastralPanel } from "./SituacaoCadastralPanel";
import { SnapshotPicker } from "./SnapshotPicker";

const CHAVE_CSV = "csv_snapshot_id";
const CHAVE_XLSX = "xlsx_snapshot_id";

function paramNumerico(params: URLSearchParams, chave: string): number | undefined {
  const valor = params.get(chave);
  if (!valor) return undefined;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : undefined;
}

/**
 * O par de snapshots em uso vive na URL (nao em estado local): torna o
 * dashboard linkavel/compartilhavel e e a mesma forma que os parametros da
 * API ja usam (`csv_snapshot_id`/`xlsx_snapshot_id`), sem estado duplicado.
 */
export function DashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const csvSnapshotId = paramNumerico(searchParams, CHAVE_CSV);
  const xlsxSnapshotId = paramNumerico(searchParams, CHAVE_XLSX);

  const snapshotsCsv = useQuery({ queryKey: ["snapshots", "csv"], queryFn: () => listarSnapshots("csv") });
  const snapshotsXlsx = useQuery({ queryKey: ["snapshots", "xlsx"], queryFn: () => listarSnapshots("xlsx") });
  const dashboard = useQuery({
    queryKey: ["dashboard", csvSnapshotId, xlsxSnapshotId],
    queryFn: () => obterDashboard({ csvSnapshotId, xlsxSnapshotId }),
  });

  function selecionarSnapshot(chave: typeof CHAVE_CSV | typeof CHAVE_XLSX, id: number) {
    const proximos = new URLSearchParams(searchParams);
    proximos.set(chave, String(id));
    setSearchParams(proximos, { replace: true });
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 border-b border-border pb-5">
        <h1 className="font-serif text-2xl font-bold tracking-tight">Dashboard</h1>
        <div className="flex flex-wrap gap-4">
          <SnapshotPicker
            label="Snapshot CSV"
            snapshots={snapshotsCsv.data}
            valorSelecionado={csvSnapshotId ?? dashboard.data?.indicadores.csv_snapshot_id}
            onSelecionar={(id) => selecionarSnapshot(CHAVE_CSV, id)}
          />
          <SnapshotPicker
            label="Snapshot XLSX"
            snapshots={snapshotsXlsx.data}
            valorSelecionado={xlsxSnapshotId ?? dashboard.data?.indicadores.xlsx_snapshot_id}
            onSelecionar={(id) => selecionarSnapshot(CHAVE_XLSX, id)}
          />
        </div>
      </header>

      {dashboard.isError ? (
        <Alert variant="destructive" role="alert">
          {dashboard.error instanceof ApiError
            ? dashboard.error.message
            : "Não foi possível carregar o dashboard."}
        </Alert>
      ) : null}

      {dashboard.isLoading ? <p className="text-sm text-muted-foreground">Carregando indicadores…</p> : null}

      {dashboard.data ? (
        <>
          <IndicadoresStrip indicadores={dashboard.data.indicadores} />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.6fr_1fr]">
            {/* min-w-0 nos dois filhos diretos do grid: sem isso, um nome de
                entidade sem espacos forca a trilha a crescer alem da fracao
                (1.6fr/1fr), estourando a largura da pagina. */}
            <div className="flex min-w-0 flex-col gap-6">
              <RankingList
                testId="ranking-obrigacoes"
                titulo="Ranking por obrigações distintas"
                descricao="Quem concentra mais débitos diferentes em aberto (ano + tipo), sem contar parcelas."
                itens={dashboard.data.ranking_obrigacoes.map((item) => ({
                  entidade: item.entidade,
                  valor: formatarNumero(item.total_obrigacoes),
                  valorSufixo: item.total_obrigacoes === 1 ? "obrigação" : "obrigações",
                }))}
              />
              <RankingList
                titulo="Ranking por valor total devido"
                descricao="Soma do valor total (XLSX) por profissional ou empresa."
                itens={dashboard.data.ranking_valor_total.map((item) => ({
                  entidade: item.entidade,
                  valor: formatarMoeda(item.valor_total),
                }))}
              />
            </div>
            <div className="flex min-w-0 flex-col gap-6">
              <DividaAtivaPanel itens={dashboard.data.divida_ativa} />
              <SituacaoCadastralPanel itens={dashboard.data.distribuicao_situacao_cadastral} />
            </div>
          </div>

          <DistribuicoesRow
            distribuicaoAno={dashboard.data.distribuicao_ano}
            distribuicaoTipo={dashboard.data.distribuicao_tipo}
            distribuicaoSituacaoPagamento={dashboard.data.distribuicao_situacao_pagamento}
          />

          <SerieHistoricaChart pontos={dashboard.data.serie_historica_xlsx} />
        </>
      ) : null}
    </div>
  );
}
