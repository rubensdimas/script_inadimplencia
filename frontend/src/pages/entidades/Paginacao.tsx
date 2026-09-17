import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatarNumero } from "@/lib/format";

interface PaginacaoProps {
  page: number;
  pages: number;
  total: number;
  onMudarPagina: (pagina: number) => void;
}

export function Paginacao({ page, pages, total, onMudarPagina }: PaginacaoProps) {
  if (total === 0) return null;

  return (
    <div className="flex items-center justify-between gap-3 border-t border-border px-6 py-3">
      <p className="text-xs text-muted-foreground">
        Página {formatarNumero(page)} de {formatarNumero(pages)} ({formatarNumero(total)} entidades)
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onMudarPagina(page - 1)}
          aria-label="Página anterior"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Anterior
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= pages}
          onClick={() => onMudarPagina(page + 1)}
          aria-label="Próxima página"
        >
          Próxima
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
