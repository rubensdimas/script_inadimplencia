import { useId, useRef, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../api/client";
import type { SnapshotOut } from "../api/types";
import { formatarData } from "../utils/format";

interface UploadCardProps {
  titulo: string;
  descricao: string;
  accept: string;
  onUpload: (arquivo: File) => Promise<SnapshotOut>;
}

export function UploadCard({ titulo, descricao, accept, onUpload }: UploadCardProps) {
  const idInput = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const [arquivoSelecionado, setArquivoSelecionado] = useState<File | null>(null);

  const mutacao = useMutation({
    mutationFn: onUpload,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["snapshots"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  function aoSubmeter(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!arquivoSelecionado) {
      return;
    }
    mutacao.mutate(arquivoSelecionado);
  }

  return (
    <section className="cartao cartao-upload" aria-label={titulo}>
      <h3>{titulo}</h3>
      <p>{descricao}</p>
      <form onSubmit={aoSubmeter}>
        <label htmlFor={idInput}>Selecionar arquivo</label>
        <input
          ref={inputRef}
          id={idInput}
          type="file"
          accept={accept}
          onChange={(evento) => setArquivoSelecionado(evento.target.files?.[0] ?? null)}
        />
        <button type="submit" disabled={!arquivoSelecionado || mutacao.isPending}>
          {mutacao.isPending ? "Enviando..." : "Enviar"}
        </button>
      </form>
      {mutacao.isSuccess && (
        <p className="mensagem-sucesso" role="status">
          Snapshot enviado: {mutacao.data.nome_arquivo_original} ({formatarData(mutacao.data.data_snapshot)})
        </p>
      )}
      {mutacao.isError && (
        <p className="mensagem-erro" role="alert">
          {mutacao.error instanceof ApiError
            ? mutacao.error.message
            : "Falha inesperada ao enviar o arquivo."}
        </p>
      )}
    </section>
  );
}
