import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { ApiError, obterEntidadeDetalhe } from "@/api/client";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ehDividaAtiva } from "@/lib/divida-ativa";
import { formatarData, formatarMoeda } from "@/lib/format";
import { ehSituacaoDeAtencao } from "@/lib/situacao-registro";

import { CamposCadastrais } from "./CamposCadastrais";

export function EntidadeDetalhePage() {
  const { entidadeId } = useParams<{ entidadeId: string }>();
  const id = Number(entidadeId);

  const detalhe = useQuery({
    queryKey: ["entidade", id],
    queryFn: () => obterEntidadeDetalhe(id),
    enabled: Number.isFinite(id),
  });

  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/entidades"
        className="flex w-fit items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Entidades
      </Link>

      {detalhe.isError ? (
        <Alert variant="destructive" role="alert">
          {detalhe.error instanceof ApiError ? detalhe.error.message : "Não foi possível carregar a entidade."}
        </Alert>
      ) : null}

      {detalhe.isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : null}

      {detalhe.data ? (
        <>
          <header className="flex flex-col gap-2 border-b border-border pb-5">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-serif text-2xl font-bold tracking-tight">{detalhe.data.entidade.nome_original}</h1>
              {detalhe.data.entidade.situacao_registro ? (
                <Badge variant={ehSituacaoDeAtencao(detalhe.data.entidade.situacao_registro) ? "warning" : "neutral"}>
                  {detalhe.data.entidade.situacao_registro}
                </Badge>
              ) : null}
            </div>
            <CamposCadastrais
              tipoPessoa={detalhe.data.entidade.tipo_pessoa}
              categoria={detalhe.data.entidade.categoria}
              registro={detalhe.data.entidade.registro_resumido}
              subregiao={detalhe.data.entidade.subregiao}
            />
            {detalhe.data.entidade.cpf_cnpj ? (
              <p className="font-mono text-sm text-muted-foreground">{detalhe.data.entidade.cpf_cnpj}</p>
            ) : null}
          </header>

          <Card>
            <CardHeader>
              <CardTitle>Histórico cadastral</CardTitle>
              <CardDescription>Dados de registro em cada snapshot XLSX em que a entidade apareceu, do mais recente ao mais antigo.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y divide-border">
                {[...detalhe.data.observacoes].reverse().map((observacao) => (
                  <li key={observacao.observacao_id} className="flex flex-wrap items-center gap-3 px-6 py-3">
                    <span className="w-24 shrink-0 text-sm text-muted-foreground">
                      {formatarData(observacao.data_snapshot)}
                    </span>
                    <span className="text-sm font-medium text-foreground">{observacao.nome_original}</span>
                    {observacao.situacao_registro ? (
                      <Badge variant={ehSituacaoDeAtencao(observacao.situacao_registro) ? "warning" : "neutral"}>
                        {observacao.situacao_registro}
                      </Badge>
                    ) : null}
                    <CamposCadastrais
                      tipoPessoa={null}
                      categoria={observacao.categoria}
                      registro={observacao.registro_resumido}
                      subregiao={observacao.subregiao}
                      className="text-xs"
                    />
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Histórico de débitos</CardTitle>
              <CardDescription>Todos os débitos (XLSX) registrados para esta entidade, do snapshot mais recente ao mais antigo.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {detalhe.data.debitos.length === 0 ? (
                <p className="px-6 pb-6 text-sm text-muted-foreground">Nenhum débito registrado.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs text-muted-foreground">
                        <th scope="col" className="px-6 py-2 font-normal">
                          Snapshot
                        </th>
                        <th scope="col" className="py-2 pr-3 font-normal">
                          Ano
                        </th>
                        <th scope="col" className="py-2 pr-3 font-normal">
                          Tipo
                        </th>
                        <th scope="col" className="py-2 pr-3 font-normal">
                          Situação de pagamento
                        </th>
                        <th scope="col" className="py-2 pr-3 font-normal">
                          Dívida ativa
                        </th>
                        <th scope="col" className="py-2 pr-3 font-normal">
                          Parcelamento
                        </th>
                        <th scope="col" className="px-6 py-2 text-right font-normal">
                          Valor total
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {[...detalhe.data.debitos].reverse().map((debito) => (
                        <tr key={debito.id}>
                          <td className="px-6 py-2 text-muted-foreground">{formatarData(debito.data_snapshot)}</td>
                          <td className="py-2 pr-3 text-foreground">{debito.ano_referencia}</td>
                          <td className="py-2 pr-3 text-foreground">{debito.tipo_debito}</td>
                          <td className="py-2 pr-3 text-foreground">{debito.situacao_pagamento ?? "—"}</td>
                          <td className="py-2 pr-3">
                            {ehDividaAtiva(debito.situacao_divida_ativa) ? (
                              <Badge variant={debito.situacao_divida_ativa === "Executiva" ? "critical" : "serious"}>
                                {debito.situacao_divida_ativa}
                              </Badge>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="py-2 pr-3 text-foreground">{debito.situacao_parcelamento ?? "—"}</td>
                          <td className="tabular-figures px-6 py-2 text-right font-medium text-foreground">
                            {debito.valor_total ? formatarMoeda(debito.valor_total) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
