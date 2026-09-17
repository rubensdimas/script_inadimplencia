import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { ApiError, listarSnapshots, obterEntidadeDetalhe } from "@/api/client";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ehDividaAtiva } from "@/lib/divida-ativa";
import { formatarData, formatarMoeda } from "@/lib/format";
import { ehSituacaoDeAtencao } from "@/lib/situacao-registro";

import { CamposCadastrais } from "./CamposCadastrais";
import { agruparObrigacoes, construirChangelogCadastral } from "./historico";

export function EntidadeDetalhePage() {
  const { entidadeId } = useParams<{ entidadeId: string }>();
  const id = Number(entidadeId);

  const detalhe = useQuery({
    queryKey: ["entidade", id],
    queryFn: () => obterEntidadeDetalhe(id),
    enabled: Number.isFinite(id),
  });

  // Para saber se uma obrigacao continua em aberto (ou se a propria entidade
  // sumiu do relatorio inteiro), e preciso comparar com o snapshot XLSX mais
  // recente do sistema como um todo — nao so o mais recente em que ESTA
  // entidade apareceu.
  const snapshotsXlsx = useQuery({ queryKey: ["snapshots", "xlsx"], queryFn: () => listarSnapshots("xlsx") });
  const snapshotMaisRecente = snapshotsXlsx.data?.[0];

  const ultimaObservacao = detalhe.data
    ? [...detalhe.data.observacoes].sort(
        (a, b) => new Date(b.data_snapshot).getTime() - new Date(a.data_snapshot).getTime(),
      )[0]
    : undefined;
  const entidadeSumiuDoUltimoSnapshot =
    snapshotMaisRecente !== undefined &&
    ultimaObservacao !== undefined &&
    ultimaObservacao.snapshot_id !== snapshotMaisRecente.id;

  const obrigacoes =
    detalhe.data && snapshotMaisRecente
      ? agruparObrigacoes(detalhe.data.debitos, snapshotMaisRecente.id)
      : undefined;
  const changelogCadastral = detalhe.data ? construirChangelogCadastral(detalhe.data.observacoes) : undefined;

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

          {entidadeSumiuDoUltimoSnapshot && snapshotMaisRecente ? (
            <Alert variant="success" className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
              <span>
                Esta entidade não aparece no snapshot XLSX mais recente ({formatarData(snapshotMaisRecente.data_snapshot)}
                ) — como o relatório só lista quem está inadimplente, isso indica que provavelmente foi regularizada
                por completo desde a última vez em que apareceu ({formatarData(ultimaObservacao!.data_snapshot)}).
              </span>
            </Alert>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Histórico cadastral</CardTitle>
              <CardDescription>
                Dado cadastral raramente muda — aqui só entra uma entrada quando algo muda de fato em relação ao
                snapshot anterior.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {changelogCadastral && changelogCadastral.length > 0 ? (
                <ul className="divide-y divide-border">
                  {changelogCadastral.map((mudanca) => (
                    <li key={mudanca.data} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-6 py-3">
                      <span className="w-24 shrink-0 text-sm text-muted-foreground">
                        {formatarData(mudanca.data)}
                      </span>
                      {mudanca.primeiraObservacao ? (
                        <span className="text-sm text-foreground">Observada pela primeira vez neste snapshot.</span>
                      ) : (
                        <ul className="flex flex-col gap-0.5">
                          {mudanca.alteracoes.map((alteracao) => (
                            <li key={alteracao.rotulo} className="text-sm text-foreground">
                              <span className="text-muted-foreground">{alteracao.rotulo}:</span>{" "}
                              {alteracao.de ?? "—"} → {alteracao.para ?? "—"}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-6 pb-6 text-sm text-muted-foreground">Sem mudanças cadastrais registradas.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Histórico de débitos</CardTitle>
              <CardDescription>
                Uma linha por obrigação (ano + tipo). "Em aberto" significa que ela aparece no snapshot XLSX mais
                recente; "Quitada" significa que apareceu antes e não aparece mais — o relatório não marca débitos
                como pagos, eles somente saem de circulação.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {!obrigacoes ? (
                <p className="px-6 pb-6 text-sm text-muted-foreground">Carregando…</p>
              ) : obrigacoes.length === 0 ? (
                <p className="px-6 pb-6 text-sm text-muted-foreground">Nenhum débito registrado.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs text-muted-foreground">
                        <th scope="col" className="px-6 py-2 font-normal">
                          Tipo
                        </th>
                        <th scope="col" className="py-2 pr-3 font-normal">
                          Ano
                        </th>
                        <th scope="col" className="py-2 pr-3 font-normal">
                          Situação
                        </th>
                        <th scope="col" className="py-2 pr-3 font-normal">
                          Dívida ativa
                        </th>
                        <th scope="col" className="py-2 pr-3 font-normal">
                          Visto 1ª vez
                        </th>
                        <th scope="col" className="py-2 pr-3 font-normal">
                          Visto por último
                        </th>
                        <th scope="col" className="px-6 py-2 text-right font-normal">
                          Valor total
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {obrigacoes.map((obrigacao) => (
                        <tr key={`${obrigacao.anoReferencia}-${obrigacao.tipoDebito}`}>
                          <td className="px-6 py-2 text-foreground">{obrigacao.tipoDebito}</td>
                          <td className="py-2 pr-3 text-foreground">{obrigacao.anoReferencia}</td>
                          <td className="py-2 pr-3">
                            <Badge variant={obrigacao.emAberto ? "neutral" : "success"}>
                              {obrigacao.emAberto ? "Em aberto" : "Quitada"}
                            </Badge>
                          </td>
                          <td className="py-2 pr-3">
                            {ehDividaAtiva(obrigacao.situacaoDividaAtiva) ? (
                              <Badge variant={obrigacao.situacaoDividaAtiva === "Executiva" ? "critical" : "serious"}>
                                {obrigacao.situacaoDividaAtiva}
                              </Badge>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="py-2 pr-3 text-muted-foreground">{formatarData(obrigacao.primeiraVez)}</td>
                          <td className="py-2 pr-3 text-muted-foreground">{formatarData(obrigacao.ultimaVez)}</td>
                          <td className="tabular-figures px-6 py-2 text-right font-medium text-foreground">
                            {obrigacao.valorTotal ? formatarMoeda(obrigacao.valorTotal) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <HistoricoBruto titulo="Ver observações cadastrais por snapshot (bruto)">
            <ul className="divide-y divide-border">
              {[...detalhe.data.observacoes]
                .sort((a, b) => new Date(b.data_snapshot).getTime() - new Date(a.data_snapshot).getTime())
                .map((observacao) => (
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
          </HistoricoBruto>

          <HistoricoBruto titulo="Ver todos os débitos por snapshot (bruto)">
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
                  {[...detalhe.data.debitos]
                    .sort((a, b) => new Date(b.data_snapshot).getTime() - new Date(a.data_snapshot).getTime())
                    .map((debito) => (
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
          </HistoricoBruto>
        </>
      ) : null}
    </div>
  );
}

interface HistoricoBrutoProps {
  titulo: string;
  children: ReactNode;
}

/** `<details>` nativo: fechado por padrao, sem estado de React nem componente novo. */
function HistoricoBruto({ titulo, children }: HistoricoBrutoProps) {
  return (
    <details className="group rounded-lg border border-border bg-card text-card-foreground">
      <summary className="cursor-pointer select-none px-6 py-4 text-sm font-medium text-muted-foreground marker:content-none group-open:text-foreground">
        {titulo}
      </summary>
      <div className="border-t border-border">{children}</div>
    </details>
  );
}
