import { describe, it, expect, vi, afterEach } from "vitest";
import { apiFetch, ApiError } from "./client";

function mockFetchOnce(status: number, body: unknown, ok: boolean) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok,
      status,
      json: async () => body,
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiFetch", () => {
  it("retorna o corpo JSON tipado em respostas de sucesso", async () => {
    mockFetchOnce(200, { id: 1 }, true);

    const resultado = await apiFetch<{ id: number }>("/api/snapshots");

    expect(resultado).toEqual({ id: 1 });
  });

  it("usa detail string diretamente quando o backend retorna um erro de negocio", async () => {
    mockFetchOnce(422, { detail: "coluna cadastral ausente" }, false);

    await expect(apiFetch("/api/uploads/xlsx")).rejects.toMatchObject({
      message: "coluna cadastral ausente",
      status: 422,
    });
  });

  it("cai em uma mensagem generica quando detail e uma lista de erros de validacao do FastAPI", async () => {
    mockFetchOnce(
      422,
      { detail: [{ loc: ["query", "csv_snapshot_id"], msg: "value is not a valid integer", type: "type_error" }] },
      false,
    );

    await expect(apiFetch("/api/dashboard?csv_snapshot_id=abc")).rejects.toBeInstanceOf(ApiError);
    await expect(apiFetch("/api/dashboard?csv_snapshot_id=abc")).rejects.toMatchObject({
      status: 422,
    });
  });

  it("nao trata a lista de erros de validacao como string exibivel", async () => {
    mockFetchOnce(422, { detail: [{ msg: "invalido" }] }, false);

    try {
      await apiFetch("/api/dashboard");
      throw new Error("deveria ter lancado ApiError");
    } catch (erro) {
      expect(erro).toBeInstanceOf(ApiError);
      expect((erro as ApiError).message).not.toContain("[object");
      expect(typeof (erro as ApiError).message).toBe("string");
    }
  });
});
