import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { EntidadesTable } from "./EntidadesTable";
import type { EntidadeResumo } from "../api/types";

const entidades: EntidadeResumo[] = [
  {
    id: 1,
    observacao_id: 10,
    nome_normalizado: "ANA PROFISSIONAL",
    nome_original: "Ana Profissional",
    cpf_cnpj: "***.***.***-11",
    tipo_pessoa: "Profissional",
    registro_resumido: "REG-1",
    categoria: "PROFISSIONAL",
    subregiao: "CAPITAL",
    situacao_registro: "ATIVO",
  },
  {
    id: 2,
    observacao_id: 11,
    nome_normalizado: "EMPRESA DEVEDORA LTDA",
    nome_original: "Empresa Devedora Ltda",
    cpf_cnpj: "**.***.***/****-92",
    tipo_pessoa: "Empresa",
    registro_resumido: null,
    categoria: "EMPRESA",
    subregiao: "CAPITAL",
    situacao_registro: "BAIXADO",
  },
];

function renderTabela(itens: EntidadeResumo[]) {
  return render(
    <MemoryRouter>
      <EntidadesTable itens={itens} />
    </MemoryRouter>,
  );
}

describe("EntidadesTable", () => {
  it("mostra uma mensagem de estado vazio quando nao ha itens", () => {
    renderTabela([]);
    expect(screen.getByText(/nenhuma entidade encontrada/i)).toBeInTheDocument();
  });

  it("lista nome, documento mascarado, tipo e situacao com link para o detalhe", () => {
    renderTabela(entidades);

    expect(screen.getByText("Ana Profissional")).toBeInTheDocument();
    expect(screen.getByText("***.***.***-11")).toBeInTheDocument();
    expect(screen.getByText("ATIVO")).toBeInTheDocument();
    expect(screen.getByText("BAIXADO")).toBeInTheDocument();

    const link = screen.getByRole("link", { name: /ana profissional/i });
    expect(link).toHaveAttribute("href", "/entidades/1");
  });
});
