from datetime import date
from io import BytesIO

from openpyxl import Workbook

COLUNAS_FIXAS = ["CPFCNPJ", "NomeRazaoSocial", "TipoPessoa", "Categoria", "SubRegiao", "SituacaoRegistro"]
COLUNAS_DEBITO = [
    "AnoReferencia",
    "DebitoTipo",
    "DataVencimento",
    "ValorOriginal",
    "ValorDevido",
    "ValorTotal",
    "DebitoSituacaoPagamentoNome",
    "DebitoSituacaoDividaAtivaNome",
    "DebitoSituacaoParcelamentoNome",
]


def construir_xlsx_registros(registros: list[list[object]], blocos_debito: int = 2) -> bytes:
    pasta = Workbook()
    aba = pasta.active
    aba.title = "Dados"

    cabecalho = [*COLUNAS_FIXAS, "RegistroResumido"] + [
        f"Debitos.{n}.{campo}" for n in range(blocos_debito) for campo in COLUNAS_DEBITO
    ]
    aba.append(cabecalho)

    for registro in registros:
        aba.append(registro)

    for linha in aba.iter_rows(min_row=2):
        for celula in linha:
            if isinstance(celula.value, date):
                celula.number_format = "dd/mm/yyyy"

    saida = BytesIO()
    pasta.save(saida)
    return saida.getvalue()


def construir_xlsx_fixture() -> bytes:
    return construir_xlsx_registros(
        [
            [
                "10.852.801/0001-39", "3 ID FISIOTERAPIA LTDA", "Empresa", "EMPRESA",
                "DISTRITO FEDERAL", "ATIVO", "CREFITO 001",
                2026, "ANUIDADE", date(2026, 4, 30), 577.0, 577.0, 620.27,
                "Não pago", "Administrativa", "Não parcelado",
                None, None, None, None, None, None, None, None, None,
            ],
            [
                "61.356.447/0001-92", "LUCAS SOARES MAIA", "Profissional", "PROFISSIONAL",
                "DISTRITO FEDERAL", "BAIXADO", "CREFITO 002",
                2026, "ANUIDADE", date(2026, 4, 30), 577.0, 504.87, 542.73,
                "Pago a menor", "Executiva", "Renegociado",
                None, None, None, None, None, None, None, None, None,
            ],
        ]
    )
