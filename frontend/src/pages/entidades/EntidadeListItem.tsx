import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

import type { EntidadeResumo } from "@/api/client";
import { Badge } from "@/components/ui/badge";
import { normalizarTexto } from "@/lib/normalizar";
import { ehSituacaoDeAtencao } from "@/lib/situacao-registro";

interface EntidadeListItemProps {
  entidade: EntidadeResumo;
}

/** Linha clicavel da busca de entidades — leva ao historico completo. */
export function EntidadeListItem({ entidade }: EntidadeListItemProps) {
  const categoriaDistinta =
    entidade.categoria && normalizarTexto(entidade.categoria) !== normalizarTexto(entidade.tipo_pessoa ?? "")
      ? entidade.categoria
      : null;
  const descricao = [entidade.tipo_pessoa, categoriaDistinta].filter(Boolean).join(" ");

  if (entidade.id === null) {
    return null;
  }

  return (
    <li>
      <Link
        to={`/entidades/${entidade.id}`}
        className="flex items-center justify-between gap-3 px-6 py-3 hover:bg-muted"
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{entidade.nome_original}</p>
          {descricao ? <p className="text-xs text-muted-foreground">{descricao}</p> : null}
          {entidade.cpf_cnpj ? <p className="font-mono text-xs text-muted-foreground">{entidade.cpf_cnpj}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {entidade.situacao_registro ? (
            <Badge variant={ehSituacaoDeAtencao(entidade.situacao_registro) ? "warning" : "neutral"}>
              {entidade.situacao_registro}
            </Badge>
          ) : null}
          <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
        </div>
      </Link>
    </li>
  );
}
