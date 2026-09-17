import type { EntidadeResumo } from "@/api/client";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { formatarNumero } from "@/lib/format";

interface ItemRanking {
  entidade: EntidadeResumo;
  valor: string;
  valorSufixo?: string;
}

interface RankingListProps {
  titulo: string;
  descricao: string;
  itens: ItemRanking[];
  /** A API devolve o ranking inteiro (usado tambem pela exportacao); o
   * dashboard mostra so os primeiros — o resto pertence a tela de Entidades. */
  limite?: number;
  testId?: string;
}

export function RankingList({ titulo, descricao, itens, limite = 10, testId }: RankingListProps) {
  const visiveis = itens.slice(0, limite);
  const restantes = itens.length - visiveis.length;

  return (
    <Card data-testid={testId}>
      <CardHeader>
        <CardTitle>{titulo}</CardTitle>
        <CardDescription>{descricao}</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {itens.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-muted-foreground">Nenhum registro para este par de snapshots.</p>
        ) : (
          <ol className="divide-y divide-border">
            {visiveis.map((item, indice) => (
              <li key={item.entidade.observacao_id} className="flex items-center gap-3 px-6 py-3">
                <span className="tabular-figures w-6 shrink-0 text-sm text-muted-foreground">{indice + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{item.entidade.nome_original}</p>
                  {item.entidade.cpf_cnpj ? (
                    <p className="font-mono text-xs text-muted-foreground">{item.entidade.cpf_cnpj}</p>
                  ) : null}
                </div>
                <span className="tabular-figures shrink-0 text-sm font-semibold text-foreground">
                  {item.valor}
                  {item.valorSufixo ? (
                    <span className="ml-1 font-normal text-muted-foreground">{item.valorSufixo}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
      {restantes > 0 ? (
        <CardFooter>
          <p className="text-xs text-muted-foreground">
            +{formatarNumero(restantes)} outras entidades neste snapshot (lista completa na tela de Entidades).
          </p>
        </CardFooter>
      ) : null}
    </Card>
  );
}
