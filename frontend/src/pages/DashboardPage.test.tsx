import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DashboardPage } from "./DashboardPage";
import { ApiError } from "../api/client";
import * as snapshotsApi from "../api/snapshots";
import * as dashboardApi from "../api/dashboard";
import type { DashboardOut, SnapshotOut } from "../api/types";

function renderPagina() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <DashboardPage />
    </QueryClientProvider>,
  );
}

const csvSnapshots: SnapshotOut[] = [
  { id: 2, tipo_arquivo: "csv", nome_arquivo_original: "csv-b.csv", data_snapshot: "2026-09-10T00:00:00", data_upload: "2026-09-10T00:00:00" },
  { id: 1, tipo_arquivo: "csv", nome_arquivo_original: "csv-a.csv", data_snapshot: "2026-08-01T00:00:00", data_upload: "2026-08-01T00:00:00" },
];

const xlsxSnapshots: SnapshotOut[] = [
  { id: 20, tipo_arquivo: "xlsx", nome_arquivo_original: "xlsx-b.xlsx", data_snapshot: "2026-09-10T00:00:00", data_upload: "2026-09-10T00:00:00" },
  { id: 10, tipo_arquivo: "xlsx", nome_arquivo_original: "xlsx-a.xlsx", data_snapshot: "2026-08-01T00:00:00", data_upload: "2026-08-01T00:00:00" },
];

const entidadeBase = {
  id: 1,
  observacao_id: 1,
  nome_normalizado: "clinica exemplo",
  nome_original: "Clinica Exemplo",
  cpf_cnpj: "***.***.***-12",
  tipo_pessoa: "PJ",
  registro_resumido: "12345-F",
  categoria: "Fisioterapeuta",
  subregiao: "Capital",
  situacao_registro: "ATIVO",
};

const dashboardFixture: DashboardOut = {
  indicadores: {
    csv_snapshot_id: 2,
    xlsx_snapshot_id: 20,
    total_entidades_xlsx: 120,
    total_obrigacoes_distintas_xlsx: 340,
    total_valor_total_xlsx: "123456.78",
    total_parcelas_em_aberto_csv: 87,
    total_debitos_divida_ativa: 15,
    total_debitos_divida_ativa_executiva: 4,
  },
  ranking_obrigacoes: [{ entidade: entidadeBase, total_obrigacoes: 12 }],
  ranking_valor_total: [{ entidade: entidadeBase, valor_total: "9999.99" }],
  divida_ativa: [
    {
      entidade: entidadeBase,
      ano_referencia: 2024,
      tipo_debito: "ANUIDADE",
      situacao_divida_ativa: "INSCRITO",
      valor_total: "500.00",
    },
  ],
  distribuicao_ano: [{ ano_referencia: 2024, quantidade: 30, valor_total: "1000.00" }],
  distribuicao_tipo: [{ tipo_debito: "ANUIDADE", quantidade: 20, valor_total: "800.00" }],
  distribuicao_situacao_pagamento: [{ situacao_pagamento: "EM ABERTO", quantidade: 10, valor_total: "400.00" }],
  distribuicao_situacao_cadastral: [
    { situacao_registro: "ATIVO", total_entidades: 100, total_com_debito_aberto: 40, total_sem_debito_aberto: 60 },
  ],
  serie_historica_xlsx: [
    { snapshot_id: 20, data_snapshot: "2026-09-10T00:00:00", total_entidades: 120, total_valor_total: "123456.78", total_divida_ativa: 15 },
  ],
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("DashboardPage", () => {
  it("mostra um estado de carregamento enquanto o dashboard nao chega", () => {
    vi.spyOn(snapshotsApi, "listarSnapshots").mockResolvedValue([]);
    vi.spyOn(dashboardApi, "obterDashboard").mockReturnValue(new Promise(() => {}));

    renderPagina();

    expect(screen.getByRole("status")).toHaveTextContent(/carregando/i);
  });

  it("mostra um erro acionavel quando o dashboard falha", async () => {
    vi.spyOn(snapshotsApi, "listarSnapshots").mockResolvedValue([]);
    vi.spyOn(dashboardApi, "obterDashboard").mockRejectedValue(
      new ApiError("nenhum snapshot csv disponivel", 404),
    );

    renderPagina();

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/nenhum snapshot csv disponivel/i);
    });
  });

  it("exibe seletores, indicadores, rankings, divida ativa, distribuicoes e evolucao historica", async () => {
    vi.spyOn(snapshotsApi, "listarSnapshots").mockImplementation((tipo) =>
      Promise.resolve(tipo === "csv" ? csvSnapshots : xlsxSnapshots),
    );
    vi.spyOn(dashboardApi, "obterDashboard").mockResolvedValue(dashboardFixture);

    renderPagina();

    await waitFor(() => {
      expect(screen.getByText(/R\$\s*123\.456,78/)).toBeInTheDocument();
    });

    // seletores de snapshot
    expect(screen.getByLabelText(/snapshot csv/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/snapshot xlsx/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/csv-a\.csv/)).toBeInTheDocument();
      expect(screen.getByText(/xlsx-a\.xlsx/)).toBeInTheDocument();
    });

    // indicadores (escopados para nao colidir com marcacoes de eixo dos graficos)
    const regiaoIndicadores = screen.getByRole("region", { name: /indicadores/i });
    expect(within(regiaoIndicadores).getByText("120")).toBeInTheDocument();
    expect(within(regiaoIndicadores).getByText("340")).toBeInTheDocument();
    expect(within(regiaoIndicadores).getByText("87")).toBeInTheDocument();

    // rankings (nome da entidade aparece nas duas listas)
    expect(screen.getAllByText(/Clinica Exemplo/i).length).toBeGreaterThanOrEqual(2);

    // divida ativa
    expect(screen.getByText("INSCRITO")).toBeInTheDocument();

    // distribuicoes (titulos das secoes)
    expect(screen.getByRole("heading", { name: /distribui[cç][aã]o por ano/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /distribui[cç][aã]o por tipo/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /situa[cç][aã]o de pagamento/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /situa[cç][aã]o cadastral/i })).toBeInTheDocument();

    // evolucao historica
    expect(screen.getByRole("heading", { name: /evolu[cç][aã]o/i })).toBeInTheDocument();
  });

  it("oferece exportacao do ranking preservando os snapshots selecionados", async () => {
    vi.spyOn(snapshotsApi, "listarSnapshots").mockImplementation((tipo) =>
      Promise.resolve(tipo === "csv" ? csvSnapshots : xlsxSnapshots),
    );
    vi.spyOn(dashboardApi, "obterDashboard").mockResolvedValue(dashboardFixture);
    const usuario = userEvent.setup();

    renderPagina();

    await waitFor(() => expect(screen.getByText(/csv-a\.csv/)).toBeInTheDocument());
    await usuario.selectOptions(screen.getByLabelText(/snapshot csv/i), "1");

    await waitFor(() => {
      const link = screen.getByRole("link", { name: /csv/i });
      expect(link).toHaveAttribute("href", expect.stringContaining("/api/exports/ranking"));
      expect(link).toHaveAttribute("href", expect.stringContaining("csv_snapshot_id=1"));
    });
  });

  it("refaz a consulta do dashboard com o snapshot escolhido no seletor", async () => {
    vi.spyOn(snapshotsApi, "listarSnapshots").mockImplementation((tipo) =>
      Promise.resolve(tipo === "csv" ? csvSnapshots : xlsxSnapshots),
    );
    const mockDashboard = vi.spyOn(dashboardApi, "obterDashboard").mockResolvedValue(dashboardFixture);
    const usuario = userEvent.setup();

    renderPagina();

    await waitFor(() => expect(screen.getByText(/csv-a\.csv/)).toBeInTheDocument());

    await usuario.selectOptions(screen.getByLabelText(/snapshot csv/i), "1");

    await waitFor(() => {
      expect(mockDashboard).toHaveBeenLastCalledWith(
        expect.objectContaining({ csvSnapshotId: 1 }),
      );
    });
  });
});
