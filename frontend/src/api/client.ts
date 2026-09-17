import type { components } from "./schema";

export type Snapshot = components["schemas"]["SnapshotOut"];
export type TipoArquivo = "csv" | "xlsx";
export type EntidadeResumo = components["schemas"]["EntidadeResumoOut"];
export type Dashboard = components["schemas"]["DashboardOut"];

interface ParametrosSnapshotPar {
  csvSnapshotId?: number;
  xlsxSnapshotId?: number;
}

/**
 * Formato de erro devolvido pela API em respostas nao-2xx. O backend usa duas
 * formas distintas para `detail`:
 * - string: erro de regra de negocio (`ErroIngestao`, sempre 422).
 * - lista de objetos `{ msg, loc, type }`: erro de validacao padrao do FastAPI
 *   (ex.: parametro de query com tipo errado, arquivo ausente).
 */
type DetalheErro = string | { msg?: string; loc?: unknown[]; type?: string }[] | undefined;

export class ApiError extends Error {
  readonly status: number;
  readonly detail: DetalheErro;

  constructor(status: number, detail: DetalheErro, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

function extrairMensagem(detail: DetalheErro, status: number): string {
  if (typeof detail === "string" && detail.trim() !== "") {
    return detail;
  }
  if (Array.isArray(detail) && detail.length > 0) {
    return detail
      .map((item) => item?.msg ?? JSON.stringify(item))
      .filter(Boolean)
      .join("; ");
  }
  return `Erro ${status} ao comunicar com a API`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // Resolvida contra `window.location.origin`: em producao e dev seguem sendo
  // requisicoes relativas ao mesmo host (o proxy do Vite cuida do `/api`); em
  // teste (jsdom, sem servidor real) evita que o fetch do undici rejeite uma
  // URL relativa por falta de base.
  const url = new URL(path, window.location.origin);
  const response = await fetch(url, init);

  if (!response.ok) {
    let detail: DetalheErro;
    try {
      const corpo = await response.json();
      detail = corpo?.detail;
    } catch {
      detail = undefined;
    }
    throw new ApiError(response.status, detail, extrairMensagem(detail, response.status));
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export function uploadCsv(arquivo: File): Promise<Snapshot> {
  const corpo = new FormData();
  corpo.append("arquivo", arquivo);
  return request<Snapshot>("/api/uploads/csv", { method: "POST", body: corpo });
}

export function uploadXlsx(arquivo: File): Promise<Snapshot> {
  const corpo = new FormData();
  corpo.append("arquivo", arquivo);
  return request<Snapshot>("/api/uploads/xlsx", { method: "POST", body: corpo });
}

export function listarSnapshots(tipoArquivo?: TipoArquivo): Promise<Snapshot[]> {
  const params = new URLSearchParams();
  if (tipoArquivo) {
    params.set("tipo_arquivo", tipoArquivo);
  }
  const query = params.toString();
  return request<Snapshot[]>(`/api/snapshots${query ? `?${query}` : ""}`);
}

function paramsSnapshotPar({ csvSnapshotId, xlsxSnapshotId }: ParametrosSnapshotPar): URLSearchParams {
  const params = new URLSearchParams();
  if (csvSnapshotId !== undefined) params.set("csv_snapshot_id", String(csvSnapshotId));
  if (xlsxSnapshotId !== undefined) params.set("xlsx_snapshot_id", String(xlsxSnapshotId));
  return params;
}

export function obterDashboard(parametros: ParametrosSnapshotPar = {}): Promise<Dashboard> {
  const query = paramsSnapshotPar(parametros).toString();
  return request<Dashboard>(`/api/dashboard${query ? `?${query}` : ""}`);
}
