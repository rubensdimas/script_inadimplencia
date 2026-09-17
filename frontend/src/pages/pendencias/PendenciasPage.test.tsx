import { HttpResponse, http } from "msw";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { EntidadeResumo } from "@/api/client";
import { renderComProvedores } from "@/test/render";
import { server } from "@/test/server";

import { PendenciasPage } from "./PendenciasPage";

function entidade(indice: number, extras: Partial<EntidadeResumo> = {}): EntidadeResumo {
  return {
    id: indice,
    observacao_id: 100 + indice,
    nome_normalizado: `ENTIDADE ${indice}`,
    nome_original: `Entidade ${indice}`,
    cpf_cnpj: `***.***.***-${String(indice).padStart(2, "0")}`,
    tipo_pessoa: "Profissional",
    registro_resumido: `${indice}-F`,
    categoria: "FISIOTERAPEUTA",
    subregiao: "Não informado",
    situacao_registro: "ATIVO",
    ...extras,
  };
}

function pendenciasFixture() {
  return {
    csv_snapshot_id: 1,
    xlsx_snapshot_id: 2,
    somente_csv: [
      { ...entidade(1), id: null, cpf_cnpj: null, tipo_pessoa: null, categoria: null, situacao_registro: null },
    ],
    somente_xlsx: [entidade(2, { nome_original: "Empresa Baixada", situacao_registro: "BAIXADO" })],
    nomes_ambiguos: [
      {
        nome_normalizado: "NOME DUPLICADO",
        nome_csv: { ...entidade(3), id: null, cpf_cnpj: null, tipo_pessoa: null, categoria: null, situacao_registro: null },
        candidatos_xlsx: [entidade(4), entidade(5, { tipo_pessoa: "Empresa", categoria: "EMPRESA" })],
      },
    ],
  };
}

function mockSnapshots() {
  server.use(
    http.get("/api/snapshots", ({ request }) => {
      const tipo = new URL(request.url).searchParams.get("tipo_arquivo");
      return HttpResponse.json([
        {
          id: tipo === "csv" ? 1 : 2,
          tipo_arquivo: tipo,
          nome_arquivo_original: `relatorio.${tipo}`,
          data_snapshot: "2026-09-15T10:00:00Z",
          data_upload: "2026-09-15T10:00:00Z",
          linhas_invalidas: [],
        },
      ]);
    }),
  );
}

function renderPendencias() {
  return renderComProvedores(
    <MemoryRouter initialEntries={["/"]}>
      <PendenciasPage />
    </MemoryRouter>,
  );
}

describe("PendenciasPage", () => {
  it("mostra a contagem de cada categoria nas abas", async () => {
    mockSnapshots();
    server.use(http.get("/api/matching-issues", () => HttpResponse.json(pendenciasFixture())));

    renderPendencias();

    expect(await screen.findByRole("tab", { name: "Somente no CSV (1)" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Somente no XLSX (1)" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Nomes ambíguos (1)" })).toBeInTheDocument();
  });

  it("comeca na aba Somente no CSV e troca de conteudo ao clicar em outra aba", async () => {
    mockSnapshots();
    server.use(http.get("/api/matching-issues", () => HttpResponse.json(pendenciasFixture())));
    const usuario = userEvent.setup();

    renderPendencias();
    await screen.findByRole("tab", { name: "Somente no CSV (1)" });

    expect(screen.getByText("Entidade 1")).toBeInTheDocument();
    expect(screen.queryByText("Empresa Baixada")).not.toBeInTheDocument();

    await usuario.click(screen.getByRole("tab", { name: "Somente no XLSX (1)" }));

    expect(screen.getByText("Empresa Baixada")).toBeInTheDocument();
    expect(screen.getByText("BAIXADO")).toBeInTheDocument();
  });

  it("mostra a tabela de candidatos na aba de nomes ambiguos", async () => {
    mockSnapshots();
    server.use(http.get("/api/matching-issues", () => HttpResponse.json(pendenciasFixture())));
    const usuario = userEvent.setup();

    renderPendencias();
    await screen.findByRole("tab", { name: "Somente no CSV (1)" });
    await usuario.click(screen.getByRole("tab", { name: "Nomes ambíguos (1)" }));

    const grupo = screen.getByText("NOME DUPLICADO").closest("li") as HTMLElement;
    expect(within(grupo).getAllByRole("row")).toHaveLength(3); // cabecalho + 2 candidatos
  });

  it("filtra a lista pela busca por nome", async () => {
    mockSnapshots();
    server.use(
      http.get("/api/matching-issues", () =>
        HttpResponse.json({
          ...pendenciasFixture(),
          somente_xlsx: [entidade(10, { nome_original: "Ana Paula" }), entidade(11, { nome_original: "Bruno Costa" })],
        }),
      ),
    );
    const usuario = userEvent.setup();

    renderPendencias();
    await screen.findByRole("tab", { name: "Somente no CSV (1)" });
    await usuario.click(screen.getByRole("tab", { name: /Somente no XLSX/ }));
    expect(screen.getByText("Ana Paula")).toBeInTheDocument();
    expect(screen.getByText("Bruno Costa")).toBeInTheDocument();

    await usuario.type(screen.getByLabelText("Buscar por nome"), "ana");

    expect(screen.getByText("Ana Paula")).toBeInTheDocument();
    expect(screen.queryByText("Bruno Costa")).not.toBeInTheDocument();
  });

  it("os links de exportacao usam o par de snapshots resolvido pela API", async () => {
    mockSnapshots();
    server.use(http.get("/api/matching-issues", () => HttpResponse.json(pendenciasFixture())));

    renderPendencias();
    await screen.findByRole("tab", { name: "Somente no CSV (1)" });

    const linkCsv = screen.getByRole("link", { name: "CSV" });
    expect(linkCsv).toHaveAttribute(
      "href",
      "/api/exports/matching-issues?csv_snapshot_id=1&xlsx_snapshot_id=2&format=csv",
    );
  });

  it("mostra mensagem de erro quando as pendencias falham ao carregar", async () => {
    mockSnapshots();
    server.use(
      http.get("/api/matching-issues", () =>
        HttpResponse.json({ detail: "snapshot xlsx informado nao encontrado" }, { status: 404 }),
      ),
    );

    renderPendencias();

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("snapshot xlsx informado nao encontrado"),
    );
  });
});
