import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listarSnapshots } from "../api/snapshots";
import { obterPendenciasPareamento } from "../api/matchingIssues";
import { ApiError } from "../api/client";
import { SnapshotSelect } from "../components/SnapshotSelect";
import { ExportButtons } from "../components/ExportButtons";
import type { EntidadeResumo, NomeAmbiguo, PendenciasPareamentoOut } from "../api/types";

export function PendenciasPage() {
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

  const pendencias = useQuery({
    queryKey: ["matching-issues", csvSnapshotId ?? "recente", xlsxSnapshotId ?? "recente"],
    queryFn: () => obterPendenciasPareamento({ csvSnapshotId, xlsxSnapshotId }),
  });

  return (
    <div>
      <div className="pagina-cabecalho">
        <h2>Pendências de pareamento</h2>
        <p>
          Nomes que não bateram automaticamente entre o CSV de débitos e o XLSX de cadastro no par de
          snapshots selecionado, para revisão manual.
        </p>
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

      {pendencias.isLoading && (
        <p className="estado-carregando" role="status">
          Carregando pendências...
        </p>
      )}

      {pendencias.isError && (
        <p className="mensagem-erro" role="alert">
          {pendencias.error instanceof ApiError
            ? pendencias.error.message
            : "Falha inesperada ao carregar as pendências."}
        </p>
      )}

      {pendencias.data && <ConteudoPendencias dados={pendencias.data} />}
    </div>
  );
}

function ConteudoPendencias({ dados }: { dados: PendenciasPareamentoOut }) {
  return (
    <>
      <ExportButtons
        dataset="matching-issues"
        rotulo="Exportar pendências"
        parametros={{
          csv_snapshot_id: dados.csv_snapshot_id,
          xlsx_snapshot_id: dados.xlsx_snapshot_id,
        }}
      />
      <ExportButtons
        dataset="comparisons"
        rotulo="Exportar comparação completa"
        parametros={{
          csv_snapshot_id: dados.csv_snapshot_id,
          xlsx_snapshot_id: dados.xlsx_snapshot_id,
        }}
      />

      <div className="grade-tres-colunas">
        <section className="cartao" aria-label="Somente no CSV">
          <h3>Somente no CSV</h3>
          <p className="secao-descricao">
            Nomes com débito no CSV que não têm correspondência exata no XLSX deste par de snapshots.
          </p>
          <ListaEntidades itens={dados.somente_csv} vazio="Nenhum nome exclusivo do CSV." />
        </section>

        <section className="cartao" aria-label="Somente no XLSX">
          <h3>Somente no XLSX</h3>
          <p className="secao-descricao">
            Nomes cadastrados no XLSX que não têm correspondência exata no CSV deste par de snapshots.
          </p>
          <ListaEntidades itens={dados.somente_xlsx} vazio="Nenhum nome exclusivo do XLSX." />
        </section>

        <section className="cartao" aria-label="Nomes ambíguos">
          <h3>Nomes ambíguos</h3>
          <p className="secao-descricao">
            Um mesmo nome normalizado do CSV corresponde a mais de um registro distinto no XLSX.
          </p>
          <ListaAmbiguos itens={dados.nomes_ambiguos} />
        </section>
      </div>
    </>
  );
}

function ListaEntidades({ itens, vazio }: { itens: EntidadeResumo[]; vazio: string }) {
  if (itens.length === 0) {
    return <p className="estado-vazio">{vazio}</p>;
  }
  return (
    <ul className="lista-pendencias">
      {itens.map((item) => (
        <li key={item.observacao_id}>
          {item.nome_original}
          {item.cpf_cnpj ? <span className="detalhe-secundario"> ({item.cpf_cnpj})</span> : null}
        </li>
      ))}
    </ul>
  );
}

function ListaAmbiguos({ itens }: { itens: NomeAmbiguo[] }) {
  if (itens.length === 0) {
    return <p className="estado-vazio">Nenhum nome ambíguo neste par de snapshots.</p>;
  }
  return (
    <ul className="lista-pendencias lista-pendencias-ambiguos">
      {itens.map((item) => (
        <li key={item.nome_normalizado}>
          <strong>{item.nome_csv.nome_original}</strong>
          <span className="detalhe-secundario"> corresponde a {item.candidatos_xlsx.length} registros no XLSX:</span>
          <ul>
            {item.candidatos_xlsx.map((candidato) => (
              <li key={candidato.observacao_id}>
                {candidato.nome_original}
                {candidato.cpf_cnpj ? (
                  <span className="detalhe-secundario"> ({candidato.cpf_cnpj})</span>
                ) : null}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}
