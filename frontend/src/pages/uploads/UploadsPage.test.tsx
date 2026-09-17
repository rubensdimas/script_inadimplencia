import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { server } from "@/test/server";
import { renderComProvedores } from "@/test/render";

import { UploadsPage } from "./UploadsPage";

const SNAPSHOT_CSV = {
  id: 10,
  tipo_arquivo: "csv",
  nome_arquivo_original: "relatorio.csv",
  data_snapshot: "2026-09-15T13:00:00Z",
  data_upload: "2026-09-15T13:00:00Z",
  linhas_invalidas: [] as string[],
};

function mockHistoricoVazio() {
  server.use(http.get("/api/snapshots", () => HttpResponse.json([])));
}

describe("UploadsPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renderiza os dois cartoes de upload independentes", () => {
    mockHistoricoVazio();
    renderComProvedores(<UploadsPage />);

    expect(screen.getByTestId("upload-card-csv")).toBeInTheDocument();
    expect(screen.getByTestId("upload-card-xlsx")).toBeInTheDocument();
  });

  it("envia o CSV selecionado e mostra o snapshot criado", async () => {
    mockHistoricoVazio();
    server.use(http.post("/api/uploads/csv", () => HttpResponse.json(SNAPSHOT_CSV, { status: 201 })));
    const usuario = userEvent.setup();
    renderComProvedores(<UploadsPage />);

    const cartaoCsv = screen.getByTestId("upload-card-csv");
    const input = within(cartaoCsv).getByLabelText(/selecionar arquivo csv/i, { exact: false });
    const arquivo = new File(["a,b\n1,2"], "relatorio.csv", { type: "text/csv" });
    await usuario.upload(input, arquivo);
    await usuario.click(within(cartaoCsv).getByRole("button", { name: /enviar/i }));

    await waitFor(() =>
      expect(within(cartaoCsv).getByText(/snapshot #10 criado/i)).toBeInTheDocument(),
    );
  });

  it("mostra as linhas invalidas quando o backend reporta documentos ignorados", async () => {
    mockHistoricoVazio();
    server.use(
      http.post("/api/uploads/xlsx", () =>
        HttpResponse.json(
          {
            ...SNAPSHOT_CSV,
            id: 11,
            tipo_arquivo: "xlsx",
            linhas_invalidas: ["linha 3 (X): CPF/CNPJ deve conter 11 ou 14 digitos"],
          },
          { status: 201 },
        ),
      ),
    );
    const usuario = userEvent.setup();
    renderComProvedores(<UploadsPage />);

    const cartaoXlsx = screen.getByTestId("upload-card-xlsx");
    const input = within(cartaoXlsx).getByLabelText(/selecionar arquivo xlsx/i, { exact: false });
    const arquivo = new File(["conteudo"], "debitos.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    await usuario.upload(input, arquivo);
    await usuario.click(within(cartaoXlsx).getByRole("button", { name: /enviar/i }));

    await waitFor(() =>
      expect(within(cartaoXlsx).getByText(/1 linha\(s\) ignorada\(s\)/i)).toBeInTheDocument(),
    );
    expect(within(cartaoXlsx).getByText(/linha 3 \(X\)/)).toBeInTheDocument();
  });

  it("mostra a mensagem de erro de negocio quando o upload falha com 422", async () => {
    mockHistoricoVazio();
    server.use(
      http.post("/api/uploads/csv", () =>
        HttpResponse.json({ detail: "CPF/CNPJ deve conter 11 ou 14 digitos" }, { status: 422 }),
      ),
    );
    const usuario = userEvent.setup();
    renderComProvedores(<UploadsPage />);

    const cartaoCsv = screen.getByTestId("upload-card-csv");
    const input = within(cartaoCsv).getByLabelText(/selecionar arquivo csv/i, { exact: false });
    const arquivo = new File(["ruim"], "ruim.csv", { type: "text/csv" });
    await usuario.upload(input, arquivo);
    await usuario.click(within(cartaoCsv).getByRole("button", { name: /enviar/i }));

    await waitFor(() =>
      expect(within(cartaoCsv).getByText("CPF/CNPJ deve conter 11 ou 14 digitos")).toBeInTheDocument(),
    );
  });

  it("exclui um snapshot do historico apos confirmacao", async () => {
    server.use(http.get("/api/snapshots", () => HttpResponse.json([SNAPSHOT_CSV])));
    let chamadaDelete = false;
    server.use(
      http.delete("/api/snapshots/10", () => {
        chamadaDelete = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const usuario = userEvent.setup();
    renderComProvedores(<UploadsPage />);

    const cartaoCsv = screen.getByTestId("upload-card-csv");
    await within(cartaoCsv).findByText("relatorio.csv");
    await usuario.click(within(cartaoCsv).getByRole("button", { name: /excluir snapshot/i }));

    expect(window.confirm).toHaveBeenCalled();
    await waitFor(() => expect(chamadaDelete).toBe(true));
  });

  it("nao exclui o snapshot quando o usuario cancela a confirmacao", async () => {
    server.use(http.get("/api/snapshots", () => HttpResponse.json([SNAPSHOT_CSV])));
    let chamadaDelete = false;
    server.use(
      http.delete("/api/snapshots/10", () => {
        chamadaDelete = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const usuario = userEvent.setup();
    renderComProvedores(<UploadsPage />);

    const cartaoCsv = screen.getByTestId("upload-card-csv");
    await within(cartaoCsv).findByText("relatorio.csv");
    await usuario.click(within(cartaoCsv).getByRole("button", { name: /excluir snapshot/i }));

    expect(window.confirm).toHaveBeenCalled();
    expect(chamadaDelete).toBe(false);
    expect(within(cartaoCsv).getByText("relatorio.csv")).toBeInTheDocument();
  });

  it("mostra mensagem de erro quando a exclusao do snapshot falha", async () => {
    server.use(http.get("/api/snapshots", () => HttpResponse.json([SNAPSHOT_CSV])));
    server.use(
      http.delete("/api/snapshots/10", () =>
        HttpResponse.json({ detail: "snapshot nao encontrado" }, { status: 404 }),
      ),
    );
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const usuario = userEvent.setup();
    renderComProvedores(<UploadsPage />);

    const cartaoCsv = screen.getByTestId("upload-card-csv");
    await within(cartaoCsv).findByText("relatorio.csv");
    await usuario.click(within(cartaoCsv).getByRole("button", { name: /excluir snapshot/i }));

    await waitFor(() =>
      expect(within(cartaoCsv).getByText("snapshot nao encontrado")).toBeInTheDocument(),
    );
  });
});
