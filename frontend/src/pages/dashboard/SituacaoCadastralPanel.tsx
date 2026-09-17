import type { Dashboard } from "@/api/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatarNumero } from "@/lib/format";

interface SituacaoCadastralPanelProps {
  itens: Dashboard["distribuicao_situacao_cadastral"];
}

/** Situacoes cadastrais em que um debito em aberto pesa mais (registro ja encerrado). */
const SITUACOES_DE_ATENCAO = new Set(["BAIXADO", "TRANSFERIDO", "CANCELADO", "SUSPENSO"]);

export function SituacaoCadastralPanel({ itens }: SituacaoCadastralPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Situação cadastral × débito</CardTitle>
        <CardDescription>Profissionais/empresas com débito em aberto, por situação de registro.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {itens.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-muted-foreground">Sem dados para este snapshot.</p>
        ) : (
          <ul className="divide-y divide-border">
            {itens.map((item) => {
              const atencao =
                SITUACOES_DE_ATENCAO.has(item.situacao_registro.toUpperCase()) && item.total_com_debito_aberto > 0;
              return (
                <li key={item.situacao_registro} className="flex items-center justify-between gap-3 px-6 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{item.situacao_registro}</span>
                    {atencao ? <Badge variant="warning">débito em aberto</Badge> : null}
                  </div>
                  <span className="tabular-figures text-sm text-muted-foreground">
                    {formatarNumero(item.total_com_debito_aberto)} de {formatarNumero(item.total_entidades)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
