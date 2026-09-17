import { HttpResponse, http } from "msw";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { EntidadeResumo } from "@/api/client";
import { renderComProvedores } from "@/test/render";
import { server } from "@/test/server";

import { DashboardPage } from "./DashboardPage";

function entidade(indice: number): EntidadeResumo {
  return {
    id: indice,
    observacao_id: 1000 + indice,
    nome_normalizado: `ENTIDADE ${indice}`,
    nome_original: `Entidade ${indice}`,
    cpf_cnpj: `***.***.***-${String(indice).padStart(2, "0")}`,
    tipo_pessoa: "Profissional",
    registro_resumido: `${indice}-F`,
    categoria: "FISIOTERAPEUTA",
    subregiao: "Não informado",
    situacao_registro: "ATIVO",
  };
}

function dashboardFixture(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    indicadores: {
      csv_snapshot_id: 1,
      xlsx_snapshot_id: 2,
      total_entidades_xlsx: 4212,
      total_obrigacoes_distintas_xlsx: 1038,
      total_valor_total_xlsx: "2437190.44",
      total_parcelas_em_aberto_csv: 612,
      total_debitos_divida_ativa: 88,
      total_debitos_divida_ativa_executiva: 12,
    },
    ranking_obrigacoes: Array.from({ length: 12 }, (_, indice) => ({
      entidade: entidade(indice),
      total_obrigacoes: 20 - indice,
    })),
    ranking_valor_total: [{ entidade: entidade(0), valor_total: "30495.00" }],
    divida_ativa: [
      {
        entidade: entidade(0),
        ano_referencia: 2024,
        tipo_debito: "ANUIDADE",
        situacao_divida_ativa: "Executiva",
        valor_total: "868.00",
      },
    ],
    distribuicao_ano: [{ ano_referencia: 2024, quantidade: 10, valor_total: "1000.00" }],
    distribuicao_tipo: [{ tipo_debito: "ANUIDADE", quantidade: 10, valor_total: "1000.00" }],
    distribuicao_situacao_pagamento: [{ situacao_pagamento: "Não pago", quantidade: 10, valor_total: "1000.00" }],
    distribuicao_situacao_cadastral: [
      { situacao_registro: "ATIVO", total_entidades: 100, total_com_debito_aberto: 100, total_sem_debito_aberto: 0 },
      { situacao_registro: "BAIXADO", total_entidades: 5, total_com_debito_aberto: 3, total_sem_debito_aberto: 2 },
    ],
    serie_historica_xlsx: [
      { snapshot_id: 1, data_snapshot: "2026-08-15T10:00:00Z", total_entidades: 4000, total_valor_total: "2000000.00", total_divida_ativa: 70 },
      { snapshot_id: 2, data_snapshot: "2026-09-15T10:00:00Z", total_entidades: 4212, total_valor_total: "2437190.44", total_divida_ativa: 88 },
    ],
    ...overrides,
  };
}

function renderDashboard(rota = "/"): ReturnType<typeof renderComProvedores> {
  const elemento: ReactElement = (
    <MemoryRouter initialEntries={[rota]}>
      <DashboardPage />
    </MemoryRouter>
  );
  return renderComProvedores(elemento);
}

function mockSnapshots() {
  server.use(
    http.get("/api/snapshots", ({ request }) => {
      const url = new URL(request.url);
      const tipo = url.searchParams.get("tipo_arquivo");
      return HttpResponse.json([
        {
          id: tipo === "csv" ? 1 : 2,
          tipo_arquivo: tipo,
          nome_arquivo_original: `relatorio.${tipo}`,
          data_snapshot: "2026-09-15T10:00:00Z",
          data_upload: "2026-09-15T10:00:00Z",
          linhas_invalidas: [],
        },
        {
          id: tipo === "csv" ? 11 : 22,
          tipo_arquivo: tipo,
          nome_arquivo_original: `relatorio-anterior.${tipo}`,
          data_snapshot: "2026-08-15T10:00:00Z",
          data_upload: "2026-08-15T10:00:00Z",
          linhas_invalidas: [],
        },
      ]);
    }),
  );
}

describe("DashboardPage", () => {
  it("mostra os indicadores formatados apos carregar", async () => {
    mockSnapshots();
    server.use(http.get("/api/dashboard", () => HttpResponse.json(dashboardFixture())));

    renderDashboard();

    expect(await screen.findByText("4.212")).toBeInTheDocument();
    expect(screen.getByText("R$ 2.437.190")).toBeInTheDocument();
    expect(screen.getByText(/12 em fase executiva/)).toBeInTheDocument();
  });

  it("limita o ranking aos 10 primeiros e informa quantos ficaram de fora", async () => {
    mockSnapshots();
    server.use(http.get("/api/dashboard", () => HttpResponse.json(dashboardFixture())));

    renderDashboard();

    await screen.findByText("4.212");
    const cartaoRanking = screen.getByTestId("ranking-obrigacoes");
    expect(within(cartaoRanking).getAllByRole("listitem")).toHaveLength(10);
    expect(within(cartaoRanking).getByText(/\+2 outras entidades/)).toBeInTheDocument();
  });

  it("mostra mensagem de erro quando o dashboard falha ao carregar", async () => {
    mockSnapshots();
    server.use(
      http.get("/api/dashboard", () => HttpResponse.json({ detail: "snapshot csv informado nao encontrado" }, { status: 404 })),
    );

    renderDashboard();

    expect(await screen.findByRole("alert")).toHaveTextContent("snapshot csv informado nao encontrado");
  });

  it("atualiza a URL ao trocar o snapshot selecionado e refaz a busca com o novo id", async () => {
    mockSnapshots();
    let ultimaQuery = "";
    server.use(
      http.get("/api/dashboard", ({ request }) => {
        ultimaQuery = new URL(request.url).search;
        return HttpResponse.json(dashboardFixture());
      }),
    );
    const usuario = userEvent.setup();

    renderDashboard();
    await screen.findByText("4.212");

    const seletorCsv = screen.getByLabelText("Snapshot CSV");
    await usuario.selectOptions(seletorCsv, "11");

    await waitFor(() => expect(ultimaQuery).toContain("csv_snapshot_id=11"));
  });
});
