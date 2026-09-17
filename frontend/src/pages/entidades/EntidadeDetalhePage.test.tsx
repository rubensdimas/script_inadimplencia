import { HttpResponse, http } from "msw";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";

import { renderComProvedores } from "@/test/render";
import { server } from "@/test/server";

import { EntidadeDetalhePage } from "./EntidadeDetalhePage";

function detalheFixture() {
  return {
    entidade: {
      id: 3031,
      observacao_id: 22028,
      nome_normalizado: "ANA BEATRIZ COSTA",
      nome_original: "Ana Beatriz Costa",
      cpf_cnpj: "***.***.***-80",
      tipo_pessoa: "Profissional",
      registro_resumido: "23263-F",
      categoria: "FISIOTERAPEUTA",
      subregiao: "Não informado",
      situacao_registro: "ATIVO",
    },
    observacoes: [
      {
        snapshot_id: 3,
        tipo_arquivo: "xlsx",
        data_snapshot: "2026-08-15T10:00:00Z",
        observacao_id: 100,
        nome_original: "Ana Beatriz Costa",
        nome_normalizado: "ANA BEATRIZ COSTA",
        cpf_cnpj: "***.***.***-80",
        tipo_pessoa: "Profissional",
        registro_resumido: "23263-F",
        categoria: "FISIOTERAPEUTA",
        subregiao: "Não informado",
        situacao_registro: "ATIVO",
      },
      {
        snapshot_id: 4,
        tipo_arquivo: "xlsx",
        data_snapshot: "2026-09-15T10:00:00Z",
        observacao_id: 22028,
        nome_original: "Ana Beatriz Costa",
        nome_normalizado: "ANA BEATRIZ COSTA",
        cpf_cnpj: "***.***.***-80",
        tipo_pessoa: "Profissional",
        registro_resumido: "23263-F",
        categoria: "FISIOTERAPEUTA",
        subregiao: "Não informado",
        situacao_registro: "ATIVO",
      },
    ],
    debitos: [
      {
        id: 1,
        snapshot_id: 3,
        data_snapshot: "2026-08-15T10:00:00Z",
        origem: "xlsx",
        ano_referencia: 2025,
        tipo_debito: "ANUIDADE",
        numero_parcela: null,
        data_vencimento: null,
        valor_original: "600.00",
        valor_devido: "600.00",
        valor_total: "600.00",
        situacao_pagamento: "Não pago",
        situacao_divida_ativa: "Não lançado",
        situacao_parcelamento: "Não parcelado",
      },
      {
        id: 2,
        snapshot_id: 4,
        data_snapshot: "2026-09-15T10:00:00Z",
        origem: "xlsx",
        ano_referencia: 2026,
        tipo_debito: "ANUIDADE",
        numero_parcela: null,
        data_vencimento: null,
        valor_original: "620.00",
        valor_devido: "620.00",
        valor_total: "620.00",
        situacao_pagamento: "Não pago",
        situacao_divida_ativa: "Administrativa",
        situacao_parcelamento: "Não parcelado",
      },
    ],
  };
}

function renderDetalhe(id = "3031") {
  return renderComProvedores(
    <MemoryRouter initialEntries={[`/entidades/${id}`]}>
      <Routes>
        <Route path="/entidades" element={<p>Lista de entidades</p>} />
        <Route path="/entidades/:entidadeId" element={<EntidadeDetalhePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("EntidadeDetalhePage", () => {
  it("mostra o resumo e o historico cadastral da entidade", async () => {
    server.use(http.get("/api/entities/3031", () => HttpResponse.json(detalheFixture())));

    renderDetalhe();

    expect(await screen.findByRole("heading", { name: "Ana Beatriz Costa" })).toBeInTheDocument();
    expect(screen.getByText("***.***.***-80")).toBeInTheDocument();
    expect(screen.getAllByText("ATIVO").length).toBeGreaterThan(0);
  });

  it("so mostra o selo de divida ativa quando a situacao e Administrativa ou Executiva", async () => {
    server.use(http.get("/api/entities/3031", () => HttpResponse.json(detalheFixture())));

    renderDetalhe();
    await screen.findByRole("heading", { name: "Ana Beatriz Costa" });

    const tabela = screen.getByRole("table");
    expect(within(tabela).getByText("Administrativa")).toBeInTheDocument();
    // "Nao lancado" nao e divida ativa de verdade: deve aparecer como travessao, nao como selo.
    expect(within(tabela).queryByText("Não lançado")).not.toBeInTheDocument();
    // A tabela mostra do snapshot mais recente ao mais antigo: linha 1 e o
    // debito de 2026 (Administrativa), linha 2 e o de 2025 (Nao lancado).
    const linhas = within(tabela).getAllByRole("row");
    expect(within(linhas[2]).getByText("—")).toBeInTheDocument();
  });

  it("mostra mensagem de erro quando a entidade nao e encontrada", async () => {
    server.use(
      http.get("/api/entities/999", () => HttpResponse.json({ detail: "entidade nao encontrada" }, { status: 404 })),
    );

    renderDetalhe("999");

    expect(await screen.findByRole("alert")).toHaveTextContent("entidade nao encontrada");
  });
});
