import type { EntidadeDetalhe } from "@/api/client";

type DebitoHistorico = EntidadeDetalhe["debitos"][number];
type ObservacaoHistorico = EntidadeDetalhe["observacoes"][number];

export interface ObrigacaoResumo {
  anoReferencia: number;
  tipoDebito: string;
  emAberto: boolean;
  primeiraVez: string;
  ultimaVez: string;
  situacaoDividaAtiva: string | null;
  valorTotal: string | null;
}

/**
 * Uma entidade so aparece no XLSX enquanto estiver inadimplente: um debito
 * quitado nao muda de status, ele simplesmente desaparece do snapshot
 * seguinte (nao ha um valor "Pago" no dado de origem). Por isso a mesma
 * obrigacao (ano + tipo) repetida uma vez por snapshot em que ficou em
 * aberto parece "duplicada" numa lista bruta — aqui ela vira uma linha so,
 * com a situacao derivada de presenca/ausencia no snapshot mais recente.
 */
export function agruparObrigacoes(
  debitos: DebitoHistorico[],
  snapshotIdMaisRecente: number,
): ObrigacaoResumo[] {
  const grupos = new Map<string, DebitoHistorico[]>();
  for (const debito of debitos) {
    const chave = `${debito.ano_referencia}|${debito.tipo_debito}`;
    const lista = grupos.get(chave);
    if (lista) {
      lista.push(debito);
    } else {
      grupos.set(chave, [debito]);
    }
  }

  const resumos: ObrigacaoResumo[] = [];
  for (const lista of grupos.values()) {
    const ordenada = [...lista].sort(
      (a, b) => new Date(a.data_snapshot).getTime() - new Date(b.data_snapshot).getTime(),
    );
    const primeira = ordenada[0];
    const ultima = ordenada[ordenada.length - 1];
    resumos.push({
      anoReferencia: primeira.ano_referencia,
      tipoDebito: primeira.tipo_debito,
      emAberto: ultima.snapshot_id === snapshotIdMaisRecente,
      primeiraVez: primeira.data_snapshot,
      ultimaVez: ultima.data_snapshot,
      situacaoDividaAtiva: ultima.situacao_divida_ativa,
      valorTotal: ultima.valor_total,
    });
  }

  resumos.sort((a, b) => {
    if (a.emAberto !== b.emAberto) return a.emAberto ? -1 : 1;
    if (a.anoReferencia !== b.anoReferencia) return b.anoReferencia - a.anoReferencia;
    return a.tipoDebito.localeCompare(b.tipoDebito);
  });
  return resumos;
}

const CAMPOS_CADASTRAIS_RASTREADOS = [
  { chave: "nome_original", rotulo: "Nome" },
  { chave: "categoria", rotulo: "Categoria" },
  { chave: "subregiao", rotulo: "Subregião" },
  { chave: "situacao_registro", rotulo: "Situação" },
  { chave: "registro_resumido", rotulo: "Registro" },
] as const satisfies { chave: keyof ObservacaoHistorico; rotulo: string }[];

export interface AlteracaoCadastral {
  rotulo: string;
  de: string | null;
  para: string | null;
}

export interface MudancaCadastral {
  data: string;
  primeiraObservacao: boolean;
  alteracoes: AlteracaoCadastral[];
}

/**
 * O dado cadastral de uma entidade dificilmente muda entre snapshots — listar
 * uma entrada por snapshot repete quase sempre a mesma coisa. Aqui so entra
 * uma entrada quando algo realmente mudou em relacao ao snapshot anterior
 * (a primeira observacao sempre entra, como marco inicial).
 */
export function construirChangelogCadastral(observacoes: ObservacaoHistorico[]): MudancaCadastral[] {
  const ordenadas = [...observacoes].sort(
    (a, b) => new Date(a.data_snapshot).getTime() - new Date(b.data_snapshot).getTime(),
  );
  const changelog: MudancaCadastral[] = [];
  let anterior: ObservacaoHistorico | null = null;

  for (const observacao of ordenadas) {
    if (anterior === null) {
      changelog.push({ data: observacao.data_snapshot, primeiraObservacao: true, alteracoes: [] });
    } else {
      const referenciaAnterior = anterior;
      const alteracoes = CAMPOS_CADASTRAIS_RASTREADOS.filter(
        (campo) => referenciaAnterior[campo.chave] !== observacao[campo.chave],
      ).map((campo) => ({
        rotulo: campo.rotulo,
        de: referenciaAnterior[campo.chave],
        para: observacao[campo.chave],
      }));
      if (alteracoes.length > 0) {
        changelog.push({ data: observacao.data_snapshot, primeiraObservacao: false, alteracoes });
      }
    }
    anterior = observacao;
  }
  return changelog;
}
