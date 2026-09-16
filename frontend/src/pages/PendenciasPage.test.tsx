import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PendenciasPage } from "./PendenciasPage";
import { ApiError } from "../api/client";
import * as snapshotsApi from "../api/snapshots";
import * as matchingIssuesApi from "../api/matchingIssues";
import type { EntidadeResumo, PendenciasPareamentoOut, SnapshotOut } from "../api/types";

function renderPagina() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <PendenciasPage />
    </QueryClientProvider>,
  );
}

const csvSnapshots: SnapshotOut[] = [
  { id: 2, tipo_arquivo: "csv", nome_arquivo_original: "csv-recente.csv", data_snapshot: "2026-09-10T00:00:00", data_upload: "2026-09-10T00:00:00" },
  { id: 1, tipo_arquivo: "csv", nome_arquivo_original: "csv-antigo.csv", data_snapshot: "2026-08-01T00:00:00", data_upload: "2026-08-01T00:00:00" },
];

const xlsxSnapshots: SnapshotOut[] = [
  { id: 20, tipo_arquivo: "xlsx", nome_arquivo_original: "xlsx-recente.xlsx", data_snapshot: "2026-09-10T00:00:00", data_upload: "2026-09-10T00:00:00" },
];

function entidade(nome: string, overrides: Partial<EntidadeResumo> = {}): EntidadeResumo {
  return {
    id: null,
    observacao_id: Math.floor(Math.random() * 100000),
    nome_normalizado: nome,
    nome_original: nome,
    cpf_cnpj: null,
    tipo_pessoa: null,
    registro_resumido: null,
    categoria: null,
    subregiao: null,
    situacao_registro: null,
    ...overrides,
  };
}

const pendenciasFixture: PendenciasPareamentoOut = {
  csv_snapshot_id: 2,
  xlsx_snapshot_id: 20,
  somente_csv: [entidade("SOMENTE CSV PESSOA")],
  somente_xlsx: [entidade("SOMENTE XLSX PESSOA", { id: 9 })],
  nomes_ambiguos: [
    {
      nome_normalizado: "CARLOS SOUZA",
      nome_csv: entidade("CARLOS SOUZA"),
      candidatos_xlsx: [entidade("CARLOS SOUZA", { id: 30 }), entidade("CARLOS SOUZA", { id: 31 })],
    },
  ],
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PendenciasPage", () => {
  it("mostra um estado de carregamento", () => {
    vi.spyOn(snapshotsApi, "listarSnapshots").mockResolvedValue([]);
    vi.spyOn(matchingIssuesApi, "obterPendenciasPareamento").mockReturnValue(new Promise(() => {}));
    renderPagina();
    expect(screen.getByRole("status")).toHaveTextContent(/carregando/i);
  });

  it("mostra um erro acionavel quando a consulta falha", async () => {
    vi.spyOn(snapshotsApi, "listarSnapshots").mockResolvedValue([]);
    vi.spyOn(matchingIssuesApi, "obterPendenciasPareamento").mockRejectedValue(
      new ApiError("nenhum snapshot xlsx disponivel", 404),
    );
    renderPagina();
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/nenhum snapshot xlsx disponivel/i);
    });
  });

  it("separa somente-csv, somente-xlsx e nomes ambiguos em secoes distintas", async () => {
    vi.spyOn(snapshotsApi, "listarSnapshots").mockImplementation((tipo) =>
      Promise.resolve(tipo === "csv" ? csvSnapshots : xlsxSnapshots),
    );
    vi.spyOn(matchingIssuesApi, "obterPendenciasPareamento").mockResolvedValue(pendenciasFixture);

    renderPagina();

    await waitFor(() => {
      expect(screen.getByText("SOMENTE CSV PESSOA")).toBeInTheDocument();
    });

    const secaoSomenteCsv = screen.getByRole("region", { name: /somente.*csv/i });
    const secaoSomenteXlsx = screen.getByRole("region", { name: /somente.*xlsx/i });
    const secaoAmbiguos = screen.getByRole("region", { name: /ambíguos/i });

    expect(within(secaoSomenteCsv).getByText("SOMENTE CSV PESSOA")).toBeInTheDocument();
    expect(within(secaoSomenteCsv).queryByText("SOMENTE XLSX PESSOA")).not.toBeInTheDocument();

    expect(within(secaoSomenteXlsx).getByText("SOMENTE XLSX PESSOA")).toBeInTheDocument();
    expect(within(secaoSomenteXlsx).queryByText("SOMENTE CSV PESSOA")).not.toBeInTheDocument();

    expect(within(secaoAmbiguos).getAllByText("CARLOS SOUZA").length).toBeGreaterThanOrEqual(2);
  });

  it("refaz a consulta ao trocar os snapshots selecionados", async () => {
    vi.spyOn(snapshotsApi, "listarSnapshots").mockImplementation((tipo) =>
      Promise.resolve(tipo === "csv" ? csvSnapshots : xlsxSnapshots),
    );
    const obterPendencias = vi
      .spyOn(matchingIssuesApi, "obterPendenciasPareamento")
      .mockResolvedValue(pendenciasFixture);
    const usuario = userEvent.setup();

    renderPagina();

    await waitFor(() => expect(screen.getByText(/csv-antigo\.csv/)).toBeInTheDocument());

    await usuario.selectOptions(screen.getByLabelText(/snapshot csv/i), "1");

    await waitFor(() => {
      expect(obterPendencias).toHaveBeenLastCalledWith(expect.objectContaining({ csvSnapshotId: 1 }));
    });
  });

  it("oferece exportacao das pendencias preservando os snapshots selecionados", async () => {
    vi.spyOn(snapshotsApi, "listarSnapshots").mockImplementation((tipo) =>
      Promise.resolve(tipo === "csv" ? csvSnapshots : xlsxSnapshots),
    );
    vi.spyOn(matchingIssuesApi, "obterPendenciasPareamento").mockResolvedValue(pendenciasFixture);
    renderPagina();

    await waitFor(() => expect(screen.getByText("SOMENTE CSV PESSOA")).toBeInTheDocument());

    const grupoExportacaoPendencias = screen.getByRole("group", { name: /exportar pend[eê]ncias/i });
    const linkCsv = within(grupoExportacaoPendencias).getByRole("link", { name: /csv/i });
    expect(linkCsv).toHaveAttribute("href", expect.stringContaining("/api/exports/matching-issues"));
    expect(linkCsv).toHaveAttribute("href", expect.stringContaining("csv_snapshot_id=2"));
    expect(linkCsv).toHaveAttribute("href", expect.stringContaining("xlsx_snapshot_id=20"));
  });
});
