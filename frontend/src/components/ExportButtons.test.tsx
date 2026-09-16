import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ExportButtons } from "./ExportButtons";

describe("ExportButtons", () => {
  it("oferece um link de download para cada formato preservando os parametros atuais", () => {
    render(
      <ExportButtons
        dataset="entities"
        parametros={{ query: "joao", tipo_pessoa: "Profissional" }}
      />,
    );

    const linkCsv = screen.getByRole("link", { name: /csv/i });
    const linkXlsx = screen.getByRole("link", { name: /xlsx/i });

    expect(linkCsv).toHaveAttribute(
      "href",
      "/api/exports/entities?format=csv&query=joao&tipo_pessoa=Profissional",
    );
    expect(linkXlsx).toHaveAttribute(
      "href",
      "/api/exports/entities?format=xlsx&query=joao&tipo_pessoa=Profissional",
    );
    expect(linkCsv).toHaveAttribute("download");
    expect(linkXlsx).toHaveAttribute("download");
  });

  it("exibe o rotulo informado", () => {
    render(<ExportButtons dataset="ranking" parametros={{}} rotulo="Exportar ranking" />);
    expect(screen.getByText("Exportar ranking")).toBeInTheDocument();
  });
});
