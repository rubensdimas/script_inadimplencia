import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { EntidadeDetalhePage } from "./EntidadeDetalhePage";
import { ApiError } from "../api/client";
import * as entitiesApi from "../api/entities";
import type { EntidadeDetalheOut } from "../api/types";

function renderPagina(id = "5") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/entidades/${id}`]}>
        <Routes>
          <Route path="/entidades/:id" element={<EntidadeDetalhePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const detalheFixture: EntidadeDetalheOut = {
  entidade: {
    id: 5,
    observacao_id: 51,
    nome_normalizado: "ANA PROFISSIONAL",
    nome_original: "Ana Profissional",
    cpf_cnpj: "***.***.***-11",
    tipo_pessoa: "Profissional",
    registro_resumido: "REG ATUAL",
    categoria: "PROFISSIONAL",
    subregiao: "CAPITAL",
    situacao_registro: "BAIXADO",
  },
  observacoes: [
    {
      snapshot_id: 1,
      tipo_arquivo: "xlsx",
      data_snapshot: "2026-01-01T00:00:00",
      observacao_id: 40,
      nome_original: "Ana Profissional",
      nome_normalizado: "ANA PROFISSIONAL",
      cpf_cnpj: "***.***.***-11",
      tipo_pessoa: "Profissional",
      registro_resumido: "REG ANTIGO",
      categoria: "PROFISSIONAL",
      subregiao: "CAPITAL",
      situacao_registro: "ATIVO",
    },
    {
      snapshot_id: 2,
      tipo_arquivo: "xlsx",
      data_snapshot: "2026-09-01T00:00:00",
      observacao_id: 51,
      nome_original: "Ana Profissional",
      nome_normalizado: "ANA PROFISSIONAL",
      cpf_cnpj: "***.***.***-11",
      tipo_pessoa: "Profissional",
      registro_resumido: "REG ATUAL",
      categoria: "PROFISSIONAL",
      subregiao: "CAPITAL",
      situacao_registro: "BAIXADO",
    },
  ],
  debitos: [
    {
      id: 100,
      snapshot_id: 1,
      data_snapshot: "2026-01-01T00:00:00",
      origem: "xlsx",
      ano_referencia: 2025,
      tipo_debito: "ANUIDADE",
      numero_parcela: null,
      data_vencimento: "2025-04-30",
      valor_original: "80.00",
      valor_devido: "80.00",
      valor_total: "80.00",
      situacao_pagamento: "Não pago",
      situacao_divida_ativa: null,
      situacao_parcelamento: "Não parcelado",
    },
    {
      id: 101,
      snapshot_id: 2,
      data_snapshot: "2026-09-01T00:00:00",
      origem: "xlsx",
      ano_referencia: 2026,
      tipo_debito: "ANUIDADE",
      numero_parcela: null,
      data_vencimento: "2026-04-30",
      valor_original: "300.00",
      valor_devido: "300.00",
      valor_total: "300.00",
      situacao_pagamento: "Não pago",
      situacao_divida_ativa: null,
      situacao_parcelamento: "Não parcelado",
    },
  ],
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("EntidadeDetalhePage", () => {
  it("mostra um estado de carregamento", () => {
    vi.spyOn(entitiesApi, "obterEntidadeDetalhe").mockReturnValue(new Promise(() => {}));
    renderPagina();
    expect(screen.getByRole("status")).toHaveTextContent(/carregando/i);
  });

  it("mostra um erro acionavel quando a entidade nao e encontrada", async () => {
    vi.spyOn(entitiesApi, "obterEntidadeDetalhe").mockRejectedValue(
      new ApiError("entidade nao encontrada", 404),
    );
    renderPagina();
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/entidade nao encontrada/i);
    });
  });

  it("busca o detalhe usando o id da rota e exibe dados atuais, historico de observacoes e debitos", async () => {
    const obterDetalhe = vi.spyOn(entitiesApi, "obterEntidadeDetalhe").mockResolvedValue(detalheFixture);
    renderPagina("5");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /ana profissional/i })).toBeInTheDocument();
    });
    expect(obterDetalhe).toHaveBeenCalledWith(5);

    // Documento mascarado, nunca o valor cru
    expect(screen.getAllByText("***.***.***-11").length).toBeGreaterThan(0);

    // Situacao cadastral atual (aparece no resumo e no historico)
    expect(screen.getAllByText("BAIXADO").length).toBeGreaterThanOrEqual(2);

    // Historico de observacoes por snapshot (situacao mudou de ATIVO -> BAIXADO)
    expect(screen.getByText("ATIVO")).toBeInTheDocument();
    expect(screen.getByText("REG ANTIGO")).toBeInTheDocument();
    expect(screen.getAllByText("REG ATUAL").length).toBeGreaterThanOrEqual(2);

    // Historico de debitos com valores convertidos (nunca a string crua sem formatacao)
    expect(screen.getByText(/R\$\s*80,00/)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*300,00/)).toBeInTheDocument();
  });
});
