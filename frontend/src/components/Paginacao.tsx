interface PaginacaoProps {
  pagina: number;
  totalPaginas: number;
  aoAlterarPagina: (pagina: number) => void;
}

export function Paginacao({ pagina, totalPaginas, aoAlterarPagina }: PaginacaoProps) {
  if (totalPaginas <= 1) {
    return null;
  }

  return (
    <div className="paginacao">
      <button type="button" disabled={pagina <= 1} onClick={() => aoAlterarPagina(pagina - 1)}>
        Anterior
      </button>
      <span>
        Página {pagina} de {totalPaginas}
      </span>
      <button
        type="button"
        disabled={pagina >= totalPaginas}
        onClick={() => aoAlterarPagina(pagina + 1)}
      >
        Próxima
      </button>
    </div>
  );
}
