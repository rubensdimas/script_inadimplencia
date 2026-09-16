import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { UploadsPage } from "./UploadsPage";
import { ApiError } from "../api/client";
import * as uploadsApi from "../api/uploads";

function renderPagina() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <UploadsPage />
    </QueryClientProvider>,
  );
}

function criarArquivo(nome: string, tipo: string) {
  return new File(["conteudo"], nome, { type: tipo });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("UploadsPage", () => {
  it("exibe cartoes independentes para CSV e XLSX", () => {
    renderPagina();

    expect(screen.getByRole("region", { name: /csv/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /xlsx/i })).toBeInTheDocument();
  });

  it("envia o CSV de forma independente e mostra sucesso apenas no cartao correspondente", async () => {
    const snapshot = {
      id: 10,
      tipo_arquivo: "csv" as const,
      nome_arquivo_original: "cadastro.csv",
      data_snapshot: "2026-09-01T00:00:00",
      data_upload: "2026-09-15T00:00:00",
    };
    vi.spyOn(uploadsApi, "enviarCsv").mockResolvedValue(snapshot);
    const usuario = userEvent.setup();
    renderPagina();

    const cartaoCsv = screen.getByRole("region", { name: /csv/i });
    const cartaoXlsx = screen.getByRole("region", { name: /xlsx/i });
    const input = within(cartaoCsv).getByLabelText(/selecionar arquivo/i) as HTMLInputElement;
    await usuario.upload(input, criarArquivo("cadastro.csv", "text/csv"));
    expect(input.files?.[0]?.name).toBe("cadastro.csv");
    await usuario.click(within(cartaoCsv).getByRole("button", { name: /enviar/i }));

    await waitFor(() => {
      expect(within(cartaoCsv).getByText(/cadastro\.csv/)).toBeInTheDocument();
    });
    expect(uploadsApi.enviarCsv).toHaveBeenCalledTimes(1);
    expect(within(cartaoXlsx).queryByText(/cadastro\.csv/)).not.toBeInTheDocument();

    // Apos sucesso, o input de arquivo e limpo (achado 4 do fix wave): o nome do
    // arquivo anterior nao deve continuar selecionado, permitindo um novo envio.
    expect(input.value).toBe("");
    expect(within(cartaoCsv).getByRole("button", { name: /enviar/i })).toBeDisabled();
  });

  it("mostra um erro acionavel no cartao XLSX sem afetar o cartao CSV", async () => {
    vi.spyOn(uploadsApi, "enviarXlsx").mockRejectedValue(
      new ApiError("coluna cadastral ausente no arquivo", 422),
    );
    const usuario = userEvent.setup();
    renderPagina();

    const cartaoXlsx = screen.getByRole("region", { name: /xlsx/i });
    const cartaoCsv = screen.getByRole("region", { name: /csv/i });
    const input = within(cartaoXlsx).getByLabelText(/selecionar arquivo/i);
    await usuario.upload(input, criarArquivo("financeiro.xlsx", "application/vnd.ms-excel"));
    await usuario.click(within(cartaoXlsx).getByRole("button", { name: /enviar/i }));

    await waitFor(() => {
      expect(within(cartaoXlsx).getByRole("alert")).toHaveTextContent(/coluna cadastral ausente/i);
    });
    expect(within(cartaoCsv).queryByRole("alert")).not.toBeInTheDocument();
  });
});
