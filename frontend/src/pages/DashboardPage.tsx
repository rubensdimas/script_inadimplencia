import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listarSnapshots } from "../api/snapshots";
import { obterDashboard } from "../api/dashboard";
import { ApiError } from "../api/client";
import type { DashboardOut } from "../api/types";
import { SnapshotSelect } from "../components/SnapshotSelect";
import { StatCard } from "../components/StatCard";
import { RankingList } from "../components/RankingList";
import { DividaAtivaTable } from "../components/DividaAtivaTable";
import { DistributionBarChart } from "../components/DistributionBarChart";
import { SituacaoCadastralChart } from "../components/SituacaoCadastralChart";
import { HistoricoChart } from "../components/HistoricoChart";
import { formatarMoeda, formatarNumero, paraNumero } from "../utils/format";

export function DashboardPage() {
  const [csvSnapshotId, setCsvSnapshotId] = useState<number | undefined>(undefined);
  const [xlsxSnapshotId, setXlsxSnapshotId] = useState<number | undefined>(undefined);

  const snapshotsCsv = useQuery({
    queryKey: ["snapshots", "csv"],
    queryFn: () => listarSnapshots("csv"),
  });
  const snapshotsXlsx = useQuery({
    queryKey: ["snapshots", "xlsx"],
    queryFn: () => listarSnapshots("xlsx"),
  });

  const dashboard = useQuery({
    queryKey: ["dashboard", csvSnapshotId ?? "recente", xlsxSnapshotId ?? "recente"],
    queryFn: () => obterDashboard({ csvSnapshotId, xlsxSnapshotId }),
  });

  return (
    <div>
      <div className="pagina-cabecalho">
        <h2>Dashboard</h2>
        <p>Indicadores consolidados a partir dos snapshots CSV e XLSX selecionados.</p>
      </div>

      <div className="selecionadores">
        <SnapshotSelect
          rotulo="Snapshot CSV"
          snapshots={snapshotsCsv.data ?? []}
          valor={csvSnapshotId}
          aoAlterar={setCsvSnapshotId}
          desabilitado={snapshotsCsv.isLoading}
        />
        <SnapshotSelect
          rotulo="Snapshot XLSX"
          snapshots={snapshotsXlsx.data ?? []}
          valor={xlsxSnapshotId}
          aoAlterar={setXlsxSnapshotId}
          desabilitado={snapshotsXlsx.isLoading}
        />
      </div>

      {dashboard.isLoading && (
        <p className="estado-carregando" role="status">
          Carregando dashboard...
        </p>
      )}

      {dashboard.isError && (
        <p className="mensagem-erro" role="alert">
          {dashboard.error instanceof ApiError
            ? dashboard.error.message
            : "Falha inesperada ao carregar o dashboard."}
        </p>
      )}

      {dashboard.data && <ConteudoDashboard dados={dashboard.data} />}
    </div>
  );
}

function ConteudoDashboard({ dados }: { dados: DashboardOut }) {
  const { indicadores } = dados;

  return (
    <>
      <section className="grid-cartoes" aria-label="Indicadores">
        <StatCard rotulo="Entidades (XLSX)" valor={formatarNumero(indicadores.total_entidades_xlsx)} />
        <StatCard
          rotulo="Obrigações distintas (XLSX)"
          valor={formatarNumero(indicadores.total_obrigacoes_distintas_xlsx)}
        />
        <StatCard rotulo="Valor total (XLSX)" valor={formatarMoeda(indicadores.total_valor_total_xlsx)} />
        <StatCard
          rotulo="Parcelas em aberto (CSV)"
          valor={formatarNumero(indicadores.total_parcelas_em_aberto_csv)}
        />
        <StatCard
          rotulo="Débitos em dívida ativa"
          valor={formatarNumero(indicadores.total_debitos_divida_ativa)}
        />
        <StatCard
          rotulo="Dívida ativa executiva"
          valor={formatarNumero(indicadores.total_debitos_divida_ativa_executiva)}
        />
      </section>

      <section className="secao grade-duas-colunas">
        <RankingList
          titulo="Ranking por obrigações"
          rotuloValor="Obrigações"
          itens={dados.ranking_obrigacoes.map((item) => ({
            chave: item.entidade.observacao_id,
            nome: item.entidade.nome_original,
            detalhe: item.entidade.cpf_cnpj,
            valor: formatarNumero(item.total_obrigacoes),
          }))}
        />
        <RankingList
          titulo="Ranking por valor total"
          rotuloValor="Valor total"
          itens={dados.ranking_valor_total.map((item) => ({
            chave: item.entidade.observacao_id,
            nome: item.entidade.nome_original,
            detalhe: item.entidade.cpf_cnpj,
            valor: formatarMoeda(item.valor_total),
          }))}
        />
      </section>

      <section className="secao">
        <h2>Dívida ativa</h2>
        <DividaAtivaTable itens={dados.divida_ativa} />
      </section>

      <section className="secao grade-graficos">
        <DistributionBarChart
          titulo="Distribuição por ano"
          dados={dados.distribuicao_ano.map((item) => ({
            rotulo: String(item.ano_referencia),
            quantidade: item.quantidade,
            valorTotal: paraNumero(item.valor_total),
          }))}
        />
        <DistributionBarChart
          titulo="Distribuição por tipo"
          dados={dados.distribuicao_tipo.map((item) => ({
            rotulo: item.tipo_debito,
            quantidade: item.quantidade,
            valorTotal: paraNumero(item.valor_total),
          }))}
        />
        <DistributionBarChart
          titulo="Distribuição por situação de pagamento"
          dados={dados.distribuicao_situacao_pagamento.map((item) => ({
            rotulo: item.situacao_pagamento,
            quantidade: item.quantidade,
            valorTotal: paraNumero(item.valor_total),
          }))}
        />
        <SituacaoCadastralChart dados={dados.distribuicao_situacao_cadastral} />
      </section>

      <section className="secao">
        <HistoricoChart dados={dados.serie_historica_xlsx} />
      </section>
    </>
  );
}
