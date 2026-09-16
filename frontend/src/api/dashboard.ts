import { apiFetch } from "./client";
import type { DashboardOut } from "./types";

export interface ParametrosDashboard {
  csvSnapshotId?: number;
  xlsxSnapshotId?: number;
}

export function obterDashboard(params: ParametrosDashboard = {}): Promise<DashboardOut> {
  const busca = new URLSearchParams();
  if (params.csvSnapshotId !== undefined) {
    busca.set("csv_snapshot_id", String(params.csvSnapshotId));
  }
  if (params.xlsxSnapshotId !== undefined) {
    busca.set("xlsx_snapshot_id", String(params.xlsxSnapshotId));
  }
  const query = busca.toString();
  return apiFetch<DashboardOut>(`/api/dashboard${query ? `?${query}` : ""}`);
}
