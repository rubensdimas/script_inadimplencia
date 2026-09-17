import { HttpResponse, http } from "msw";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";

import { renderComProvedores } from "@/test/render";
import { server } from "@/test/server";

import { EntidadeDetalhePage } from "./EntidadeDetalhePage";

const OBSERVACAO_BASE = {
  observacao_id: 100,
  nome_original: "Ana Beatriz Costa",
  nome_normalizado: "ANA BEATRIZ COSTA",
  cpf_cnpj: "***.***.***-80",
  tipo_pessoa: "Profissional",
  registro_resumido: "23263-F",
  categoria: "FISIOTERAPEUTA",
  subregiao: "Não informado",
  situacao_registro: "ATIVO",
  tipo_arquivo: "xlsx",
};

const DEBITO_BASE = {
  origem: "xlsx",
  numero_parcela: null,
  data_vencimento: null,
  valor_original: "600.00",
  valor_devido: "600.00",
  valor_total: "600.00",
  situacao_pagamento: "Não pago",
  situacao_parcelamento: "Não parcelado",
};

// snapshot 3 = mais antigo, snapshot 4 = mais recente (o snapshot XLSX mais
// recente do sistema, nao so o mais recente em que a entidade apareceu).
function detalheFixture(overrides: Partial<ReturnType<typeof detalheFixtureBase>> = {}) {
  return { ...detalheFixtureBase(), ...overrides };
}

function detalheFixtureBase() {
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
      { ...OBSERVACAO_BASE, snapshot_id: 3, data_snapshot: "2026-08-15T10:00:00Z", observacao_id: 100 },
      { ...OBSERVACAO_BASE, snapshot_id: 4, data_snapshot: "2026-09-15T10:00:00Z", observacao_id: 22028 },
    ],
    debitos: [
      // ANUIDADE 2026 aparece nos dois snapshots (a mesma obrigacao "duplicada"
      // que motivou o ajuste) — deve virar uma linha so, em aberto.
      {
        ...DEBITO_BASE,
        id: 1,
        snapshot_id: 3,
        data_snapshot: "2026-08-15T10:00:00Z",
        ano_referencia: 2026,
        tipo_debito: "ANUIDADE",
        situacao_divida_ativa: "Não lançado",
      },
      {
        ...DEBITO_BASE,
        id: 2,
        snapshot_id: 4,
        data_snapshot: "2026-09-15T10:00:00Z",
        ano_referencia: 2026,
        tipo_debito: "ANUIDADE",
        situacao_divida_ativa: "Administrativa",
        valor_total: "650.00",
      },
      // MULTA ELEITORAL 2025 so aparece no snapshot antigo — quitada.
      {
        ...DEBITO_BASE,
        id: 3,
        snapshot_id: 3,
        data_snapshot: "2026-08-15T10:00:00Z",
        ano_referencia: 2025,
        tipo_debito: "MULTA ELEITORAL",
        situacao_divida_ativa: "Não lançado",
        valor_total: "150.00",
      },
    ],
  };
}

function mockSnapshotMaisRecente(snapshotId: number, dataSnapshot: string) {
  server.use(
    http.get("/api/snapshots", () =>
      HttpResponse.json([
        {
          id: snapshotId,
          tipo_arquivo: "xlsx",
          nome_arquivo_original: "debitos.xlsx",
          data_snapshot: dataSnapshot,
          data_upload: dataSnapshot,
          linhas_invalidas: [],
        },
      ]),
    ),
  );
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
  it("mostra o resumo cadastral da entidade", async () => {
    mockSnapshotMaisRecente(4, "2026-09-15T10:00:00Z");
    server.use(http.get("/api/entities/3031", () => HttpResponse.json(detalheFixture())));

    renderDetalhe();

    expect(await screen.findByRole("heading", { name: "Ana Beatriz Costa" })).toBeInTheDocument();
    expect(screen.getByText("***.***.***-80")).toBeInTheDocument();
    expect(screen.getAllByText("ATIVO").length).toBeGreaterThan(0);
  });

  it("agrupa a mesma obrigacao repetida em uma linha, com a situacao correta", async () => {
    mockSnapshotMaisRecente(4, "2026-09-15T10:00:00Z");
    server.use(http.get("/api/entities/3031", () => HttpResponse.json(detalheFixture())));

    renderDetalhe();
    await screen.findByRole("heading", { name: "Ana Beatriz Costa" });

    // Duas obrigacoes distintas (ANUIDADE 2026 e MULTA ELEITORAL 2025), nao
    // tres linhas (nao repete a ANUIDADE por aparecer em dois snapshots).
    const tabelaObrigacoes = screen.getAllByRole("table")[0];
    const linhas = within(tabelaObrigacoes).getAllByRole("row");
    expect(linhas).toHaveLength(3); // cabecalho + 2 obrigacoes

    expect(within(tabelaObrigacoes).getByText("Em aberto")).toBeInTheDocument();
    expect(within(tabelaObrigacoes).getByText("Quitada")).toBeInTheDocument();
    // Divida ativa da ANUIDADE (em aberto) usa a ocorrencia mais recente.
    expect(within(tabelaObrigacoes).getByText("Administrativa")).toBeInTheDocument();
    // "Nao lancado" nunca aparece como selo — nem para a obrigacao quitada.
    expect(within(tabelaObrigacoes).queryByText("Não lançado")).not.toBeInTheDocument();
  });

  it("mostra so uma entrada de changelog cadastral quando nada muda entre snapshots", async () => {
    mockSnapshotMaisRecente(4, "2026-09-15T10:00:00Z");
    server.use(http.get("/api/entities/3031", () => HttpResponse.json(detalheFixture())));

    renderDetalhe();

    expect(await screen.findByText("Observada pela primeira vez neste snapshot.")).toBeInTheDocument();
    expect(screen.queryByText(/ATIVO → BAIXADO/)).not.toBeInTheDocument();
  });

  it("registra a mudanca de situacao cadastral no changelog", async () => {
    mockSnapshotMaisRecente(4, "2026-09-15T10:00:00Z");
    const fixture = detalheFixtureBase();
    fixture.observacoes[1] = { ...fixture.observacoes[1], situacao_registro: "BAIXADO" };
    server.use(http.get("/api/entities/3031", () => HttpResponse.json(fixture)));

    renderDetalhe();

    expect(await screen.findByText(/ATIVO → BAIXADO/)).toBeInTheDocument();
  });

  it("avisa quando a entidade nao aparece no snapshot XLSX mais recente do sistema", async () => {
    // O snapshot mais recente do SISTEMA (id 9) e mais novo que a ultima
    // observacao desta entidade (snapshot 4) — provavelmente regularizada.
    mockSnapshotMaisRecente(9, "2026-10-01T10:00:00Z");
    server.use(http.get("/api/entities/3031", () => HttpResponse.json(detalheFixture())));

    renderDetalhe();

    expect(await screen.findByText(/provavelmente foi regularizada/)).toBeInTheDocument();
  });

  it("nao avisa quando a entidade aparece no snapshot XLSX mais recente", async () => {
    mockSnapshotMaisRecente(4, "2026-09-15T10:00:00Z");
    server.use(http.get("/api/entities/3031", () => HttpResponse.json(detalheFixture())));

    renderDetalhe();

    await screen.findByRole("heading", { name: "Ana Beatriz Costa" });
    expect(screen.queryByText(/provavelmente foi regularizada/)).not.toBeInTheDocument();
  });

  it("mantem o historico bruto por snapshot escondido atras de um details fechado", async () => {
    mockSnapshotMaisRecente(4, "2026-09-15T10:00:00Z");
    server.use(http.get("/api/entities/3031", () => HttpResponse.json(detalheFixture())));

    renderDetalhe();
    await screen.findByRole("heading", { name: "Ana Beatriz Costa" });

    const detalhesBrutos = screen.getAllByText(/bruto/i).map((elemento) => elemento.closest("details"));
    expect(detalhesBrutos.every((details) => details && !details.open)).toBe(true);
  });

  it("mostra mensagem de erro quando a entidade nao e encontrada", async () => {
    mockSnapshotMaisRecente(4, "2026-09-15T10:00:00Z");
    server.use(
      http.get("/api/entities/999", () => HttpResponse.json({ detail: "entidade nao encontrada" }, { status: 404 })),
    );

    renderDetalhe("999");

    expect(await screen.findByRole("alert")).toHaveTextContent("entidade nao encontrada");
  });
});
