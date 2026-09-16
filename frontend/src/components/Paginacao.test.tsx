import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Paginacao } from "./Paginacao";

describe("Paginacao", () => {
  it("mostra a pagina atual e o total de paginas", () => {
    render(<Paginacao pagina={2} totalPaginas={5} aoAlterarPagina={() => {}} />);
    expect(screen.getByText(/p[aá]gina 2 de 5/i)).toBeInTheDocument();
  });

  it("desabilita 'anterior' na primeira pagina e 'proxima' na ultima", () => {
    const { rerender } = render(<Paginacao pagina={1} totalPaginas={3} aoAlterarPagina={() => {}} />);
    expect(screen.getByRole("button", { name: /anterior/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /pr[oó]xima/i })).not.toBeDisabled();

    rerender(<Paginacao pagina={3} totalPaginas={3} aoAlterarPagina={() => {}} />);
    expect(screen.getByRole("button", { name: /anterior/i })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: /pr[oó]xima/i })).toBeDisabled();
  });

  it("chama aoAlterarPagina com a pagina seguinte/anterior ao clicar", async () => {
    const usuario = userEvent.setup();
    const aoAlterarPagina = vi.fn();
    render(<Paginacao pagina={2} totalPaginas={5} aoAlterarPagina={aoAlterarPagina} />);

    await usuario.click(screen.getByRole("button", { name: /pr[oó]xima/i }));
    expect(aoAlterarPagina).toHaveBeenCalledWith(3);

    await usuario.click(screen.getByRole("button", { name: /anterior/i }));
    expect(aoAlterarPagina).toHaveBeenCalledWith(1);
  });

  it("nao renderiza controles quando ha apenas uma pagina", () => {
    render(<Paginacao pagina={1} totalPaginas={1} aoAlterarPagina={() => {}} />);
    expect(screen.queryByRole("button", { name: /anterior/i })).not.toBeInTheDocument();
  });
});
