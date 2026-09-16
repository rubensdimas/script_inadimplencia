import { apiFetch } from "./client";
import type { SnapshotOut } from "./types";

function enviarArquivo(caminho: string, arquivo: File): Promise<SnapshotOut> {
  const formData = new FormData();
  formData.append("arquivo", arquivo);
  return apiFetch<SnapshotOut>(caminho, { method: "POST", body: formData });
}

export function enviarCsv(arquivo: File): Promise<SnapshotOut> {
  return enviarArquivo("/api/uploads/csv", arquivo);
}

export function enviarXlsx(arquivo: File): Promise<SnapshotOut> {
  return enviarArquivo("/api/uploads/xlsx", arquivo);
}
