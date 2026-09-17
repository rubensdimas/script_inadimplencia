import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";

import { ApiError, listarSnapshots, uploadCsv } from "@/api/client";
import { server } from "@/test/server";

const SNAPSHOT_EXEMPLO = {
  id: 1,
  tipo_arquivo: "csv",
  nome_arquivo_original: "relatorio.csv",
  data_snapshot: "2026-09-15T10:00:00Z",
  data_upload: "2026-09-15T10:00:00Z",
  linhas_invalidas: [],
};

describe("listarSnapshots", () => {
  it("retorna a lista tipada de snapshots", async () => {
    server.use(
      http.get("/api/snapshots", () => HttpResponse.json([SNAPSHOT_EXEMPLO])),
    );

    const resultado = await listarSnapshots();

    expect(resultado).toEqual([SNAPSHOT_EXEMPLO]);
  });

  it("envia tipo_arquivo como query param quando informado", async () => {
    let urlRecebida: string | undefined;
    server.use(
      http.get("/api/snapshots", ({ request }) => {
        urlRecebida = request.url;
        return HttpResponse.json([]);
      }),
    );

    await listarSnapshots("xlsx");

    expect(urlRecebida).toContain("tipo_arquivo=xlsx");
  });
});

describe("uploadCsv", () => {
  it("envia o arquivo como multipart e retorna o snapshot criado", async () => {
    let nomeArquivoRecebido: string | undefined;
    server.use(
      http.post("/api/uploads/csv", async ({ request }) => {
        const corpo = await request.formData();
        const parte = corpo.get("arquivo");
        nomeArquivoRecebido = parte && typeof parte === "object" && "name" in parte ? parte.name : undefined;
        return HttpResponse.json(SNAPSHOT_EXEMPLO, { status: 201 });
      }),
    );

    const arquivo = new File(["conteudo"], "relatorio.csv", { type: "text/csv" });
    const resultado = await uploadCsv(arquivo);

    expect(nomeArquivoRecebido).toBe("relatorio.csv");
    expect(resultado).toEqual(SNAPSHOT_EXEMPLO);
  });

  it("propaga mensagem de erro de negocio (detail em string) como ApiError", async () => {
    server.use(
      http.post("/api/uploads/csv", () =>
        HttpResponse.json({ detail: "CPF/CNPJ deve conter 11 ou 14 digitos" }, { status: 422 }),
      ),
    );

    const arquivo = new File(["x"], "ruim.csv", { type: "text/csv" });

    await expect(uploadCsv(arquivo)).rejects.toMatchObject({
      name: "ApiError",
      status: 422,
      message: "CPF/CNPJ deve conter 11 ou 14 digitos",
    });
  });

  it("propaga erro de validacao do FastAPI (detail em lista) juntando as mensagens", async () => {
    server.use(
      http.post("/api/uploads/csv", () =>
        HttpResponse.json(
          {
            detail: [
              { loc: ["body", "arquivo"], msg: "field required", type: "value_error.missing" },
            ],
          },
          { status: 422 },
        ),
      ),
    );

    const arquivo = new File(["x"], "ruim.csv", { type: "text/csv" });

    await expect(uploadCsv(arquivo)).rejects.toMatchObject({
      status: 422,
      message: "field required",
    });
  });

  it("usa mensagem generica quando a resposta de erro nao tem corpo JSON", async () => {
    server.use(http.post("/api/uploads/csv", () => new HttpResponse(null, { status: 500 })));

    const arquivo = new File(["x"], "ruim.csv", { type: "text/csv" });

    await expect(uploadCsv(arquivo)).rejects.toBeInstanceOf(ApiError);
    await expect(uploadCsv(arquivo)).rejects.toMatchObject({
      status: 500,
      message: "Erro 500 ao comunicar com a API",
    });
  });
});
