import csv
from dataclasses import dataclass
from datetime import date, datetime
from io import StringIO


@dataclass
class RegistroCsv:
    nome_original: str
    tipo_debito: str
    ano_referencia: int
    numero_parcela: int
    data_vencimento: date
    situacao_parcelamento: str


def parse_csv(conteudo: bytes) -> list[RegistroCsv]:
    texto = conteudo.decode("latin-1")
    leitor = csv.reader(StringIO(texto), delimiter=";")
    registros = []
    for linha in leitor:
        if not linha or not linha[0].strip():
            continue
        nome, tipo_debito, ano, parcela, vencimento, status = linha
        registros.append(
            RegistroCsv(
                nome_original=nome.strip(),
                tipo_debito=tipo_debito.strip(),
                ano_referencia=int(ano),
                numero_parcela=int(parcela),
                data_vencimento=datetime.strptime(vencimento.strip(), "%d/%m/%Y").date(),
                situacao_parcelamento=status.strip(),
            )
        )
    return registros
