import { apiFetch } from "./client";
import type { SnapshotOut, TipoArquivo } from "./types";

export function listarSnapshots(tipoArquivo?: TipoArquivo): Promise<SnapshotOut[]> {
  const query = tipoArquivo ? `?tipo_arquivo=${tipoArquivo}` : "";
  return apiFetch<SnapshotOut[]>(`/api/snapshots${query}`);
}
