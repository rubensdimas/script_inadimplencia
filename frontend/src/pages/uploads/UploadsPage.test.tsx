import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
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
});
