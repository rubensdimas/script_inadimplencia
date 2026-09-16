import { describe, it, expect } from "vitest";
import { montarUrlExportacao } from "./exports";

describe("montarUrlExportacao", () => {
  it("monta a URL com o dataset e o formato informados", () => {
    expect(montarUrlExportacao("entities", "csv")).toBe("/api/exports/entities?format=csv");
  });

  it("inclui apenas os parametros com valor definido", () => {
    const url = montarUrlExportacao("entities", "xlsx", {
      query: "joao",
      tipo_pessoa: undefined,
      situacao_registro: "",
    });
    expect(url).toBe("/api/exports/entities?format=xlsx&query=joao");
  });

  it("inclui parametros de snapshot para datasets baseados em pareamento", () => {
    const url = montarUrlExportacao("matching-issues", "csv", {
      csv_snapshot_id: 7,
      xlsx_snapshot_id: 12,
    });
    expect(url).toBe("/api/exports/matching-issues?format=csv&csv_snapshot_id=7&xlsx_snapshot_id=12");
  });
});
