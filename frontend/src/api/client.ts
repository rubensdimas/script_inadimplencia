// Cliente HTTP tipado para a API do backend, montado sobre `fetch`.
//
// O corpo de erro do backend tem dois formatos possiveis:
// - erros de negocio (ErroIngestao, HTTPException): {"detail": "mensagem"}
// - erros de validacao de request do proprio FastAPI: {"detail": [{...}, ...]}
// `ApiError.message` normaliza os dois para uma string exibivel na UI.

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function extrairMensagemDetail(corpo: unknown, status: number): string {
  if (corpo && typeof corpo === "object" && "detail" in corpo) {
    const detail = (corpo as { detail?: unknown }).detail;
    if (typeof detail === "string" && detail.length > 0) {
      return detail;
    }
  }
  return `Nao foi possivel completar a requisicao (HTTP ${status}).`;
}

export async function apiFetch<T>(caminho: string, init?: RequestInit): Promise<T> {
  let resposta: Response;
  try {
    resposta = await fetch(caminho, init);
  } catch {
    throw new ApiError("Nao foi possivel conectar ao servidor. Verifique sua conexao.", 0);
  }

  if (!resposta.ok) {
    let corpo: unknown = null;
    try {
      corpo = await resposta.json();
    } catch {
      corpo = null;
    }
    throw new ApiError(extrairMensagemDetail(corpo, resposta.status), resposta.status);
  }

  if (resposta.status === 204) {
    return undefined as T;
  }

  return (await resposta.json()) as T;
}
