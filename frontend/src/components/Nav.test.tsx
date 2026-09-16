import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { Nav } from "./Nav";

function renderComRotas(caminhoInicial = "/") {
  return render(
    <MemoryRouter initialEntries={[caminhoInicial]}>
      <Nav />
      <Routes>
        <Route path="/" element={<div>Conteudo Dashboard</div>} />
        <Route path="/uploads" element={<div>Conteudo Uploads</div>} />
        <Route path="/entidades" element={<div>Conteudo Entidades</div>} />
        <Route path="/pendencias" element={<div>Conteudo Pendencias</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Nav", () => {
  it("exibe os 4 itens de navegacao exigidos", () => {
    renderComRotas();
    expect(screen.getByRole("link", { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /uploads/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /entidades/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /pend[eê]ncias/i })).toBeInTheDocument();
  });

  it("navega para a pagina de Uploads ao clicar no item correspondente", async () => {
    const usuario = userEvent.setup();
    renderComRotas();

    await usuario.click(screen.getByRole("link", { name: /uploads/i }));

    expect(screen.getByText("Conteudo Uploads")).toBeInTheDocument();
  });

  it("marca o item ativo com aria-current=page", () => {
    renderComRotas("/entidades");

    expect(screen.getByRole("link", { name: /entidades/i })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /dashboard/i })).not.toHaveAttribute("aria-current");
  });
});
