// Construtores de fixtures sinteticas para a jornada E2E do Playwright.
//
// Espelha, em TypeScript, o mesmo espirito de backend/tests/fixture_builders.py:
// nenhum documento real, tudo montado em memoria a partir de dados inventados,
// no formato exato que os parsers do backend esperam
// (backend/app/parsers/csv_parser.py e backend/app/parsers/xlsx_parser.py).
import ExcelJS from "exceljs";

const COLUNAS_FIXAS = ["CPFCNPJ", "NomeRazaoSocial", "TipoPessoa", "Categoria", "SubRegiao", "SituacaoRegistro"];
const COLUNAS_DEBITO = [
  "AnoReferencia",
  "DebitoTipo",
  "DataVencimento",
  "ValorOriginal",
  "ValorDevido",
  "ValorTotal",
  "DebitoSituacaoPagamentoNome",
  "DebitoSituacaoDividaAtivaNome",
  "DebitoSituacaoParcelamentoNome",
];

export interface DebitoXlsxFixture {
  ano: number;
  tipo: string;
  vencimento: Date;
  valor: number;
  situacaoPagamento?: string;
  situacaoDividaAtiva?: string | null;
  situacaoParcelamento?: string;
}

export interface RegistroXlsxFixture {
  documento: string;
  nome: string;
  tipoPessoa: string;
  categoria: string;
  subregiao: string;
  situacaoRegistro: string;
  registroResumido: string;
  debitos?: DebitoXlsxFixture[];
}

/** Monta um XLSX sintetico no formato "largo" (blocos Debitos.N.*) esperado pelo backend. */
export async function construirXlsxFixture(
  registros: RegistroXlsxFixture[],
  blocosDebito = 2,
): Promise<Buffer> {
  const pasta = new ExcelJS.Workbook();
  const aba = pasta.addWorksheet("Dados");

  const cabecalho: string[] = [...COLUNAS_FIXAS, "RegistroResumido"];
  for (let n = 0; n < blocosDebito; n += 1) {
    for (const campo of COLUNAS_DEBITO) {
      cabecalho.push(`Debitos.${n}.${campo}`);
    }
  }
  aba.addRow(cabecalho);

  // Colunas de data (1-based, para ExcelJS.Row.getCell) de cada bloco de debito,
  // resolvidas uma unica vez a partir do cabecalho para nao depender de contagem manual.
  const colunasData = Array.from({ length: blocosDebito }, (_, n) =>
    cabecalho.indexOf(`Debitos.${n}.DataVencimento`) + 1,
  );

  for (const registro of registros) {
    const debitos = registro.debitos ?? [];
    const linha: unknown[] = [
      registro.documento,
      registro.nome,
      registro.tipoPessoa,
      registro.categoria,
      registro.subregiao,
      registro.situacaoRegistro,
      registro.registroResumido,
    ];
    for (let n = 0; n < blocosDebito; n += 1) {
      const debito = debitos[n];
      if (debito) {
        linha.push(
          debito.ano,
          debito.tipo,
          debito.vencimento,
          debito.valor,
          debito.valor,
          debito.valor,
          debito.situacaoPagamento ?? "Nao pago",
          debito.situacaoDividaAtiva ?? null,
          debito.situacaoParcelamento ?? "Nao parcelado",
        );
      } else {
        linha.push(null, null, null, null, null, null, null, null, null);
      }
    }
    const linhaAdicionada = aba.addRow(linha);
    for (let n = 0; n < blocosDebito; n += 1) {
      if (debitos[n]) {
        linhaAdicionada.getCell(colunasData[n]).numFmt = "dd/mm/yyyy";
      }
    }
  }

  const buffer = await pasta.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export interface DebitoCsvFixture {
  nome: string;
  tipoDebito: string;
  ano: number;
  parcela: number;
  vencimento: string; // dd/mm/yyyy
  situacao: string;
}

/** Monta um CSV sintetico ";"-separado, sem cabecalho, no formato esperado pelo backend. */
export function construirCsvFixture(linhas: DebitoCsvFixture[]): Buffer {
  const texto =
    linhas
      .map((linha) => [linha.nome, linha.tipoDebito, linha.ano, linha.parcela, linha.vencimento, linha.situacao].join(";"))
      .join("\n") + "\n";
  return Buffer.from(texto, "latin1");
}
