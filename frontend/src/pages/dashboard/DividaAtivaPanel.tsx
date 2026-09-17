import type { Dashboard } from "@/api/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { formatarMoeda, formatarNumero } from "@/lib/format";

interface DividaAtivaPanelProps {
  itens: Dashboard["divida_ativa"];
  limite?: number;
}

export function DividaAtivaPanel({ itens, limite = 12 }: DividaAtivaPanelProps) {
  const visiveis = itens.slice(0, limite);
  const restantes = itens.length - visiveis.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dívida ativa</CardTitle>
        <CardDescription>Débitos em cobrança administrativa ou executiva; fase executiva primeiro.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {itens.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-muted-foreground">Nenhum débito em dívida ativa neste snapshot.</p>
        ) : (
          <ul className="divide-y divide-border">
            {visiveis.map((item, indice) => (
              <li
                key={`${item.entidade.observacao_id}-${item.ano_referencia}-${item.tipo_debito}-${indice}`}
                className="flex items-start justify-between gap-3 px-6 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{item.entidade.nome_original}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.tipo_debito} ({item.ano_referencia})
                  </p>
                  <Badge variant={item.situacao_divida_ativa === "Executiva" ? "critical" : "serious"} className="mt-1">
                    {item.situacao_divida_ativa}
                  </Badge>
                </div>
                <span className="tabular-figures shrink-0 text-sm font-semibold text-foreground">
                  {item.valor_total ? formatarMoeda(item.valor_total) : "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      {restantes > 0 ? (
        <CardFooter>
          <p className="text-xs text-muted-foreground">
            +{formatarNumero(restantes)} outros débitos em dívida ativa neste snapshot.
          </p>
        </CardFooter>
      ) : null}
    </Card>
  );
}
