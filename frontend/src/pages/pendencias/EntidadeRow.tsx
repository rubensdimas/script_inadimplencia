import type { EntidadeResumo } from "@/api/client";
import { Badge } from "@/components/ui/badge";
import { normalizarTexto } from "@/lib/normalizar";
import { ehSituacaoDeAtencao } from "@/lib/situacao-registro";

interface EntidadeRowProps {
  entidade: EntidadeResumo;
}

/**
 * Linha de uma entidade sozinha numa fonte (somente CSV ou somente XLSX).
 * O lado CSV nunca tem documento/cadastro (a fonte nao gera vinculo canonico
 * permanente) — os campos ficam ausentes com naturalidade, nao como erro.
 */
export function EntidadeRow({ entidade }: EntidadeRowProps) {
  // Para Empresa, a categoria e sempre "EMPRESA" — repetir o tipo_pessoa nao
  // acrescenta informacao. So mostra a categoria quando ela distingue algo
  // (ex.: "Profissional" + "FISIOTERAPEUTA").
  const categoriaDistinta =
    entidade.categoria && normalizarTexto(entidade.categoria) !== normalizarTexto(entidade.tipo_pessoa ?? "")
      ? entidade.categoria
      : null;
  const descricao = [entidade.tipo_pessoa, categoriaDistinta].filter(Boolean).join(" ");

  return (
    <li className="flex items-start justify-between gap-3 px-6 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{entidade.nome_original}</p>
        {descricao ? <p className="text-xs text-muted-foreground">{descricao}</p> : null}
        {entidade.cpf_cnpj ? <p className="font-mono text-xs text-muted-foreground">{entidade.cpf_cnpj}</p> : null}
      </div>
      {entidade.situacao_registro ? (
        <Badge variant={ehSituacaoDeAtencao(entidade.situacao_registro) ? "warning" : "neutral"} className="shrink-0">
          {entidade.situacao_registro}
        </Badge>
      ) : null}
    </li>
  );
}
