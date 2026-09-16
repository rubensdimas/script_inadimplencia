import { apiFetch } from "./client";
import type { PendenciasPareamentoOut } from "./types";

export interface ParametrosPendencias {
  csvSnapshotId?: number;
  xlsxSnapshotId?: number;
}

export function obterPendenciasPareamento(
  params: ParametrosPendencias = {},
): Promise<PendenciasPareamentoOut> {
  const busca = new URLSearchParams();
  if (params.csvSnapshotId !== undefined) {
    busca.set("csv_snapshot_id", String(params.csvSnapshotId));
  }
  if (params.xlsxSnapshotId !== undefined) {
    busca.set("xlsx_snapshot_id", String(params.xlsxSnapshotId));
  }
  const query = busca.toString();
  return apiFetch<PendenciasPareamentoOut>(`/api/matching-issues${query ? `?${query}` : ""}`);
}
