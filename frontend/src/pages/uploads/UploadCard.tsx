import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Loader2, Trash2 } from "lucide-react";

import { ApiError, type Snapshot, type TipoArquivo, deletarSnapshot, listarSnapshots } from "@/api/client";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatarDataHora } from "@/lib/format";

interface UploadCardProps {
  tipoArquivo: TipoArquivo;
  titulo: string;
  descricao: string;
  accept: string;
  enviar: (arquivo: File) => Promise<Snapshot>;
}

export function UploadCard({ tipoArquivo, titulo, descricao, accept, enviar }: UploadCardProps) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const queryClient = useQueryClient();

  const historico = useQuery({
    queryKey: ["snapshots", tipoArquivo],
    queryFn: () => listarSnapshots(tipoArquivo),
  });

  const upload = useMutation({
    mutationFn: enviar,
    onSuccess: () => {
      setArquivo(null);
      queryClient.invalidateQueries({ queryKey: ["snapshots", tipoArquivo] });
    },
  });

  const remocao = useMutation({
    mutationFn: deletarSnapshot,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["snapshots", tipoArquivo] });
    },
  });

  function excluirSnapshot(snapshot: Snapshot) {
    const confirmado = window.confirm(
      `Excluir o snapshot de "${snapshot.nome_arquivo_original}" (${formatarDataHora(snapshot.data_snapshot)})? ` +
        "Os dados desse envio e o arquivo original serão apagados. Essa ação não pode ser desfeita.",
    );
    if (confirmado) {
      remocao.mutate(snapshot.id);
    }
  }

  const ultimoEnvio = upload.data;

  return (
    <Card data-testid={`upload-card-${tipoArquivo}`}>
      <CardHeader>
        <CardTitle>{titulo}</CardTitle>
        <CardDescription>{descricao}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-center"
          onSubmit={(evento) => {
            evento.preventDefault();
            if (arquivo) upload.mutate(arquivo);
          }}
        >
          {/*
            min-w-0: um <input type="file"> nativo tem uma largura minima
            intrinseca (o texto "Nenhum arquivo escolhido" nao encolhe nem
            quebra linha, e nao e algo que CSS consiga truncar). Sem min-w-0
            no item flex, essa largura minima forcava o form inteiro (e o
            botao Enviar ao lado, que estica pela largura do form) para alem
            da viewport em telas estreitas.
          */}
          <label className="min-w-0 flex-1">
            <span className="sr-only">Selecionar arquivo {tipoArquivo.toUpperCase()}</span>
            <input
              type="file"
              accept={accept}
              onChange={(evento) => setArquivo(evento.target.files?.[0] ?? null)}
              className="block w-full max-w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-medium file:text-secondary-foreground hover:file:bg-secondary/80"
            />
          </label>
          <Button type="submit" disabled={!arquivo || upload.isPending} className="shrink-0">
            {upload.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            Enviar
          </Button>
        </form>

        {upload.isError ? (
          <Alert variant="destructive">
            {upload.error instanceof ApiError
              ? upload.error.message
              : "Falha inesperada ao enviar o arquivo."}
          </Alert>
        ) : null}

        {upload.isSuccess && ultimoEnvio ? (
          <div className="flex flex-col gap-2">
            <Alert variant="success" className="flex items-start gap-2">
              <CheckCircle2 aria-hidden />
              <span>
                Snapshot #{ultimoEnvio.id} criado a partir de{" "}
                <strong>{ultimoEnvio.nome_arquivo_original}</strong>, referente a{" "}
                {formatarDataHora(ultimoEnvio.data_snapshot)}.
              </span>
            </Alert>
            {ultimoEnvio.linhas_invalidas.length > 0 ? (
              <Alert variant="destructive" className="flex flex-col items-start gap-2">
                <span className="flex items-center gap-2 font-medium">
                  <AlertTriangle className="h-4 w-4" aria-hidden />
                  {ultimoEnvio.linhas_invalidas.length} linha(s) ignorada(s) por documento inválido
                </span>
                <ul className="ml-6 list-disc space-y-0.5">
                  {ultimoEnvio.linhas_invalidas.map((linha) => (
                    <li key={linha}>{linha}</li>
                  ))}
                </ul>
              </Alert>
            ) : null}
          </div>
        ) : null}

        <div>
          <h4 className="mb-2 text-sm font-medium text-muted-foreground">Últimos envios</h4>
          {remocao.isError ? (
            <Alert variant="destructive" className="mb-2">
              {remocao.error instanceof ApiError
                ? remocao.error.message
                : "Não foi possível excluir o snapshot."}
            </Alert>
          ) : null}
          {historico.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : historico.isError ? (
            <p className="text-sm text-destructive">Não foi possível carregar o histórico.</p>
          ) : historico.data && historico.data.length > 0 ? (
            <ul className="flex flex-col gap-1 text-sm">
              {historico.data.slice(0, 5).map((snapshot) => (
                <li key={snapshot.id} className="flex items-center justify-between gap-3 text-muted-foreground">
                  <span className="min-w-0 flex-1 truncate">{snapshot.nome_arquivo_original}</span>
                  <span className="shrink-0">{formatarDataHora(snapshot.data_snapshot)}</span>
                  <button
                    type="button"
                    onClick={() => excluirSnapshot(snapshot)}
                    disabled={remocao.isPending}
                    aria-label={`Excluir snapshot de ${snapshot.nome_arquivo_original}`}
                    className="shrink-0 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum envio ainda.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
