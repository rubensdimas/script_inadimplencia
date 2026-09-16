import os
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy.orm import Session

from app.models import Debito, Entidade, Snapshot
from app.normalize import normalize_nome
from app.parsers.csv_parser import parse_csv
from app.parsers.xlsx_parser import parse_xlsx
from app.snapshot_date import extrair_data_snapshot


def _raw_uploads_dir() -> Path:
    return Path(os.environ.get("RAW_UPLOADS_DIR", "/data/raw_uploads"))


def _buscar_ou_criar_entidade(
    sessao: Session,
    cache: dict[str, Entidade],
    nome_original: str,
    extras: dict[str, str | None] | None = None,
) -> Entidade:
    nome_normalizado = normalize_nome(nome_original)
    entidade = cache.get(nome_normalizado)
    if entidade is None:
        entidade = sessao.query(Entidade).filter_by(nome_normalizado=nome_normalizado).one_or_none()
    if entidade is None:
        entidade = Entidade(nome_normalizado=nome_normalizado, nome_original=nome_original)
        sessao.add(entidade)
        sessao.flush()
    else:
        entidade.nome_original = nome_original

    if extras:
        for campo, valor in extras.items():
            if valor is not None:
                setattr(entidade, campo, valor)

    cache[nome_normalizado] = entidade
    return entidade


def _criar_snapshot(sessao: Session, tipo_arquivo: str, nome_arquivo: str, conteudo: bytes) -> Snapshot:
    agora = datetime.now(timezone.utc).replace(tzinfo=None)
    snapshot = Snapshot(
        tipo_arquivo=tipo_arquivo,
        nome_arquivo_original=nome_arquivo,
        caminho_arquivo_bruto="",
        data_snapshot=extrair_data_snapshot(nome_arquivo, agora),
        data_upload=agora,
    )
    sessao.add(snapshot)
    sessao.flush()

    diretorio = _raw_uploads_dir()
    diretorio.mkdir(parents=True, exist_ok=True)
    nome_seguro = Path(nome_arquivo).name
    caminho = diretorio / f"{snapshot.id}_{nome_seguro}"
    caminho.write_bytes(conteudo)
    snapshot.caminho_arquivo_bruto = str(caminho)

    return snapshot


def ingerir_csv(sessao: Session, nome_arquivo: str, conteudo: bytes) -> Snapshot:
    snapshot = _criar_snapshot(sessao, "csv", nome_arquivo, conteudo)

    cache_entidades: dict[str, Entidade] = {}
    for registro in parse_csv(conteudo):
        entidade = _buscar_ou_criar_entidade(sessao, cache_entidades, registro.nome_original)
        sessao.add(
            Debito(
                snapshot_id=snapshot.id,
                entidade_id=entidade.id,
                origem="csv",
                ano_referencia=registro.ano_referencia,
                tipo_debito=registro.tipo_debito,
                numero_parcela=registro.numero_parcela,
                data_vencimento=registro.data_vencimento,
                situacao_parcelamento=registro.situacao_parcelamento,
            )
        )

    sessao.commit()
    sessao.refresh(snapshot)
    return snapshot


def ingerir_xlsx(sessao: Session, nome_arquivo: str, conteudo: bytes) -> Snapshot:
    snapshot = _criar_snapshot(sessao, "xlsx", nome_arquivo, conteudo)

    cache_entidades: dict[str, Entidade] = {}
    for registro in parse_xlsx(conteudo):
        entidade = _buscar_ou_criar_entidade(
            sessao,
            cache_entidades,
            registro.nome_original,
            extras={
                "cpf_cnpj": registro.cpf_cnpj,
                "tipo_pessoa": registro.tipo_pessoa,
                "categoria": registro.categoria,
                "subregiao": registro.subregiao,
                "situacao_registro": registro.situacao_registro,
            },
        )
        for debito in registro.debitos:
            sessao.add(
                Debito(
                    snapshot_id=snapshot.id,
                    entidade_id=entidade.id,
                    origem="xlsx",
                    ano_referencia=debito.ano_referencia,
                    tipo_debito=debito.tipo_debito,
                    data_vencimento=debito.data_vencimento,
                    valor_original=debito.valor_original,
                    valor_devido=debito.valor_devido,
                    valor_total=debito.valor_total,
                    situacao_pagamento=debito.situacao_pagamento,
                    situacao_divida_ativa=debito.situacao_divida_ativa,
                    situacao_parcelamento=debito.situacao_parcelamento,
                )
            )

    sessao.commit()
    sessao.refresh(snapshot)
    return snapshot
