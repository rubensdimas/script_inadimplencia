import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { EntidadesPage } from "./EntidadesPage";
import { ApiError } from "../api/client";
import * as entitiesApi from "../api/entities";
import type { EntidadeResumo, PaginaEntidadesOut } from "../api/types";

function renderPagina() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <EntidadesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const entidade: EntidadeResumo = {
  id: 5,
  observacao_id: 50,
  nome_normalizado: "JOAO DA SILVA",
  nome_original: "Joao da Silva",
  cpf_cnpj: "***.***.***-11",
  tipo_pessoa: "Profissional",
  registro_resumido: "REG-5",
  categoria: "PROFISSIONAL",
  subregiao: "CAPITAL",
  situacao_registro: "ATIVO",
};

function paginaFixture(overrides: Partial<PaginaEntidadesOut> = {}): PaginaEntidadesOut {
  return {
    items: [entidade],
    total: 1,
    page: 1,
    page_size: 20,
    pages: 1,
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("EntidadesPage", () => {
  it("mostra um estado de carregamento enquanto a busca nao chega", () => {
    vi.spyOn(entitiesApi, "buscarEntidades").mockReturnValue(new Promise(() => {}));
    renderPagina();
    expect(screen.getByRole("status")).toHaveTextContent(/carregando/i);
  });

  it("mostra um erro acionavel quando a busca falha", async () => {
    vi.spyOn(entitiesApi, "buscarEntidades").mockRejectedValue(new ApiError("falha ao buscar", 500));
    renderPagina();
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/falha ao buscar/i);
    });
  });

  it("carrega a lista inicial sem filtros e exibe a tabela", async () => {
    const buscar = vi.spyOn(entitiesApi, "buscarEntidades").mockResolvedValue(paginaFixture());
    renderPagina();

    await waitFor(() => {
      expect(screen.getByText("Joao da Silva")).toBeInTheDocument();
    });
    expect(buscar).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, pageSize: 20 }),
    );
  });

  it("busca por nome, filtra por tipo de pessoa e situacao cadastral ao submeter o formulario", async () => {
    const buscar = vi.spyOn(entitiesApi, "buscarEntidades").mockResolvedValue(paginaFixture());
    const usuario = userEvent.setup();
    renderPagina();

    await waitFor(() => expect(screen.getByText("Joao da Silva")).toBeInTheDocument());

    await usuario.type(screen.getByLabelText(/nome/i), "joao");
    await usuario.selectOptions(screen.getByLabelText(/tipo de pessoa/i), "Profissional");
    await usuario.type(screen.getByLabelText(/situa[cç][aã]o cadastral/i), "ATIVO");
    await usuario.click(screen.getByRole("button", { name: /buscar/i }));

    await waitFor(() => {
      expect(buscar).toHaveBeenLastCalledWith(
        expect.objectContaining({
          query: "joao",
          tipoPessoa: "Profissional",
          situacaoRegistro: "ATIVO",
          page: 1,
        }),
      );
    });
  });

  it("pagina os resultados e reflete a pagina atual", async () => {
    const buscar = vi
      .spyOn(entitiesApi, "buscarEntidades")
      .mockResolvedValue(paginaFixture({ total: 45, pages: 3, page: 1 }));
    const usuario = userEvent.setup();
    renderPagina();

    await waitFor(() => expect(screen.getByText(/p[aá]gina 1 de 3/i)).toBeInTheDocument());

    await usuario.click(screen.getByRole("button", { name: /pr[oó]xima/i }));

    await waitFor(() => {
      expect(buscar).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
    });
  });

  it("oferece exportacao em csv e xlsx preservando os filtros aplicados", async () => {
    vi.spyOn(entitiesApi, "buscarEntidades").mockResolvedValue(paginaFixture());
    const usuario = userEvent.setup();
    renderPagina();

    await waitFor(() => expect(screen.getByText("Joao da Silva")).toBeInTheDocument());

    await usuario.type(screen.getByLabelText(/nome/i), "joao");
    await usuario.click(screen.getByRole("button", { name: /buscar/i }));

    await waitFor(() => {
      expect(screen.getByRole("link", { name: /csv/i })).toHaveAttribute(
        "href",
        expect.stringContaining("query=joao"),
      );
    });
    expect(screen.getByRole("link", { name: /csv/i })).toHaveAttribute(
      "href",
      expect.stringContaining("/api/exports/entities"),
    );
    expect(screen.getByRole("link", { name: /xlsx/i })).toHaveAttribute(
      "href",
      expect.stringContaining("format=xlsx"),
    );
  });

  it("mostra uma mensagem quando a busca nao encontra resultados", async () => {
    vi.spyOn(entitiesApi, "buscarEntidades").mockResolvedValue(paginaFixture({ items: [], total: 0, pages: 0 }));
    renderPagina();

    await waitFor(() => {
      expect(screen.getByText(/nenhuma entidade encontrada/i)).toBeInTheDocument();
    });
  });
});
