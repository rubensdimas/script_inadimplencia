import { HttpResponse, http } from "msw";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { EntidadeResumo } from "@/api/client";
import { renderComProvedores } from "@/test/render";
import { server } from "@/test/server";

import { EntidadesPage } from "./EntidadesPage";

function entidade(indice: number): EntidadeResumo {
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
  };
}

function paginaFixture(itens: EntidadeResumo[], overrides: Partial<Record<string, unknown>> = {}) {
  return {
    items: itens,
    total: itens.length,
    page: 1,
    page_size: 50,
    pages: 1,
    ...overrides,
  };
}

function renderEntidades() {
  return renderComProvedores(
    <MemoryRouter initialEntries={["/entidades"]}>
      <Routes>
        <Route path="/entidades" element={<EntidadesPage />} />
        <Route path="/entidades/:entidadeId" element={<p>Tela de detalhe</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("EntidadesPage", () => {
  it("lista as entidades retornadas pela API", async () => {
    server.use(
      http.get("/api/entities", () => HttpResponse.json(paginaFixture([entidade(1), entidade(2)]))),
    );

    renderEntidades();

    expect(await screen.findByText("Entidade 1")).toBeInTheDocument();
    expect(screen.getByText("Entidade 2")).toBeInTheDocument();
  });

  it("envia o texto de busca para a API apos o debounce", async () => {
    let ultimaQuery: string | null = null;
    server.use(
      http.get("/api/entities", ({ request }) => {
        ultimaQuery = new URL(request.url).searchParams.get("query");
        return HttpResponse.json(paginaFixture([]));
      }),
    );
    const usuario = userEvent.setup();

    renderEntidades();
    await usuario.type(screen.getByLabelText("Nome"), "ana");

    await waitFor(() => expect(ultimaQuery).toBe("ana"), { timeout: 1000 });
  });

  it("envia o filtro de tipo de pessoa imediatamente, sem debounce", async () => {
    let ultimoTipo: string | null = null;
    server.use(
      http.get("/api/entities", ({ request }) => {
        ultimoTipo = new URL(request.url).searchParams.get("tipo_pessoa");
        return HttpResponse.json(paginaFixture([]));
      }),
    );
    const usuario = userEvent.setup();

    renderEntidades();
    await usuario.selectOptions(screen.getByLabelText("Tipo de pessoa"), "Empresa");

    await waitFor(() => expect(ultimoTipo).toBe("Empresa"));
  });

  it("mostra mensagem quando nenhuma entidade atende aos filtros", async () => {
    server.use(http.get("/api/entities", () => HttpResponse.json(paginaFixture([]))));

    renderEntidades();

    expect(await screen.findByText("Nenhuma entidade encontrada com esses filtros.")).toBeInTheDocument();
  });

  it("navega para o detalhe ao clicar em uma entidade", async () => {
    server.use(http.get("/api/entities", () => HttpResponse.json(paginaFixture([entidade(1)]))));
    const usuario = userEvent.setup();

    renderEntidades();
    await usuario.click(await screen.findByText("Entidade 1"));

    expect(await screen.findByText("Tela de detalhe")).toBeInTheDocument();
  });

  it("desabilita o botao Proxima na ultima pagina", async () => {
    server.use(
      http.get("/api/entities", () =>
        HttpResponse.json(paginaFixture([entidade(1)], { page: 2, pages: 2, total: 2 })),
      ),
    );

    renderEntidades();

    expect(await screen.findByRole("button", { name: /Próxima página/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Página anterior/ })).toBeEnabled();
  });
});
