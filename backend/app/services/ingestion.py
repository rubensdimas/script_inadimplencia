import logging
import os
from collections.abc import Sequence
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.documentos import normalizar_documento
from app.errors import ErroIngestao
from app.models import Debito, Entidade, ObservacaoEntidade, Snapshot
from app.normalize import normalize_nome
from app.parsers.csv_parser import RegistroCsv, parse_csv
from app.parsers.xlsx_parser import RegistroXlsx, parse_xlsx
from app.snapshot_date import extrair_data_snapshot

logger = logging.getLogger(__name__)


def _raw_uploads_dir() -> Path:
    return Path(os.environ.get("RAW_UPLOADS_DIR", "/data/raw_uploads"))


def _criar_snapshot(sessao: Session, tipo_arquivo: str, nome_arquivo: str) -> Snapshot:
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
    return snapshot


def _salvar_arquivo_bruto(snapshot: Snapshot, conteudo: bytes) -> Path:
    diretorio = _raw_uploads_dir()
    diretorio.mkdir(parents=True, exist_ok=True)
    nome_seguro = Path(snapshot.nome_arquivo_original).name
    caminho = diretorio / f"{snapshot.id}_{nome_seguro}"
    temporario = diretorio / f".{snapshot.id}_{uuid4().hex}.staging"
    try:
        temporario.write_bytes(conteudo)
        temporario.replace(caminho)
    finally:
        temporario.unlink(missing_ok=True)
    snapshot.caminho_arquivo_bruto = str(caminho)
    return caminho


def _observacao_csv(
    sessao: Session,
    snapshot: Snapshot,
    cache: dict[str, ObservacaoEntidade],
    nome_original: str,
) -> ObservacaoEntidade:
    nome_normalizado = normalize_nome(nome_original)
    observacao = cache.get(nome_normalizado)
    if observacao is None:
        observacao = ObservacaoEntidade(
            snapshot=snapshot,
            entidade_id=None,
            nome_original=nome_original,
            nome_normalizado=nome_normalizado,
        )
        sessao.add(observacao)
        sessao.flush()
        cache[nome_normalizado] = observacao
    else:
        observacao.nome_original = nome_original
    return observacao


def _entidade_por_documento(
    sessao: Session,
    cache: dict[str, Entidade],
    documento: str,
    tipo_pessoa: str | None,
) -> Entidade:
    entidade = cache.get(documento)
    if entidade is None:
        entidade = sessao.scalar(select(Entidade).where(Entidade.documento_normalizado == documento))
    if entidade is None:
        entidade = Entidade(documento_normalizado=documento, tipo_pessoa=tipo_pessoa)
        sessao.add(entidade)
        sessao.flush()
    elif tipo_pessoa is not None:
        entidade.tipo_pessoa = tipo_pessoa
    cache[documento] = entidade
    return entidade


def _persistir_csv(sessao: Session, snapshot: Snapshot, registros: Sequence[RegistroCsv]) -> None:
    cache: dict[str, ObservacaoEntidade] = {}
    for registro in registros:
        observacao = _observacao_csv(sessao, snapshot, cache, registro.nome_original)
        sessao.add(
            Debito(
                observacao=observacao,
                origem="csv",
                ano_referencia=registro.ano_referencia,
                tipo_debito=registro.tipo_debito,
                numero_parcela=registro.numero_parcela,
                data_vencimento=registro.data_vencimento,
                situacao_parcelamento=registro.situacao_parcelamento,
            )
        )


@dataclass
class ResultadoPersistenciaXlsx:
    linhas_invalidas: list[str] = field(default_factory=list)
    observacoes_persistidas: int = 0
    debitos_persistidos: int = 0


def _persistir_xlsx(
    sessao: Session, snapshot: Snapshot, registros: Sequence[RegistroXlsx]
) -> ResultadoPersistenciaXlsx:
    cache_entidades: dict[str, Entidade] = {}
    resultado = ResultadoPersistenciaXlsx()
    for registro in registros:
        try:
            documento = normalizar_documento(registro.cpf_cnpj)
        except ErroIngestao as exc:
            resultado.linhas_invalidas.append(
                f"linha {registro.linha} ({registro.nome_original}): {exc}"
            )
            continue
        entidade = (
            _entidade_por_documento(sessao, cache_entidades, documento, registro.tipo_pessoa)
            if documento is not None
            else None
        )
        observacao = ObservacaoEntidade(
            snapshot=snapshot,
            entidade=entidade,
            nome_original=registro.nome_original,
            nome_normalizado=normalize_nome(registro.nome_original),
            cpf_cnpj=registro.cpf_cnpj,
            tipo_pessoa=registro.tipo_pessoa,
            registro_resumido=registro.registro_resumido,
            categoria=registro.categoria,
            subregiao=registro.subregiao,
            situacao_registro=registro.situacao_registro,
        )
        sessao.add(observacao)
        resultado.observacoes_persistidas += 1
        for debito in registro.debitos:
            if not debito.tipo_debito:
                raise ErroIngestao("debito XLSX sem tipo")
            sessao.add(
                Debito(
                    observacao=observacao,
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
            resultado.debitos_persistidos += 1

    if resultado.linhas_invalidas and len(resultado.linhas_invalidas) == len(registros):
        raise ErroIngestao("; ".join(resultado.linhas_invalidas))
    return resultado


def _ingerir(
    sessao: Session,
    tipo_arquivo: str,
    nome_arquivo: str,
    conteudo: bytes,
    registros: Sequence[RegistroCsv] | Sequence[RegistroXlsx],
) -> Snapshot:
    caminho: Path | None = None
    linhas_invalidas: list[str] = []
    try:
        snapshot = _criar_snapshot(sessao, tipo_arquivo, nome_arquivo)
        caminho = _salvar_arquivo_bruto(snapshot, conteudo)
        if tipo_arquivo == "csv":
            _persistir_csv(sessao, snapshot, registros)  # type: ignore[arg-type]
        else:
            linhas_invalidas = _persistir_xlsx(sessao, snapshot, registros).linhas_invalidas  # type: ignore[arg-type]
        sessao.commit()
    except Exception:
        sessao.rollback()
        if caminho is not None:
            caminho.unlink(missing_ok=True)
        raise
    sessao.refresh(snapshot)
    snapshot.linhas_invalidas = linhas_invalidas
    return snapshot


def ingerir_csv(sessao: Session, nome_arquivo: str, conteudo: bytes) -> Snapshot:
    return _ingerir(sessao, "csv", nome_arquivo, conteudo, parse_csv(conteudo))


def ingerir_xlsx(sessao: Session, nome_arquivo: str, conteudo: bytes) -> Snapshot:
    try:
        registros = parse_xlsx(conteudo)
    except ErroIngestao:
        raise
    except Exception as exc:
        raise ErroIngestao("estrutura XLSX invalida") from exc
    return _ingerir(sessao, "xlsx", nome_arquivo, conteudo, registros)


def contar_debitos_do_snapshot(sessao: Session, snapshot_id: int) -> int:
    return (
        sessao.scalar(
            select(func.count(Debito.id))
            .join(ObservacaoEntidade)
            .where(ObservacaoEntidade.snapshot_id == snapshot_id)
        )
        or 0
    )


def reprocessar_snapshot(sessao: Session, snapshot: Snapshot) -> None:
    caminho = Path(snapshot.caminho_arquivo_bruto)
    if not caminho.is_file():
        raise ErroIngestao(f"arquivo bruto ausente para snapshot {snapshot.id}")
    conteudo = caminho.read_bytes()
    if snapshot.tipo_arquivo == "csv":
        registros = parse_csv(conteudo)
        esperado_observacoes = len({normalize_nome(registro.nome_original) for registro in registros})
        esperado_debitos = len(registros)
    elif snapshot.tipo_arquivo == "xlsx":
        registros = parse_xlsx(conteudo)
    else:
        raise ErroIngestao(f"tipo de arquivo invalido no snapshot {snapshot.id}")

    try:
        sessao.execute(delete(ObservacaoEntidade).where(ObservacaoEntidade.snapshot_id == snapshot.id))
        if snapshot.tipo_arquivo == "csv":
            _persistir_csv(sessao, snapshot, registros)  # type: ignore[arg-type]
        else:
            resultado = _persistir_xlsx(sessao, snapshot, registros)  # type: ignore[arg-type]
            esperado_observacoes = resultado.observacoes_persistidas
            esperado_debitos = resultado.debitos_persistidos
            if resultado.linhas_invalidas:
                logger.warning(
                    "snapshot %s: %d linha(s) com documento invalido ignoradas ao reprocessar: %s",
                    snapshot.id,
                    len(resultado.linhas_invalidas),
                    "; ".join(resultado.linhas_invalidas),
                )
        sessao.flush()
        observacoes_persistidas = sessao.scalar(
            select(func.count(ObservacaoEntidade.id)).where(
                ObservacaoEntidade.snapshot_id == snapshot.id
            )
        ) or 0
        debitos_persistidos = contar_debitos_do_snapshot(sessao, snapshot.id)
        if (observacoes_persistidas, debitos_persistidos) != (
            esperado_observacoes,
            esperado_debitos,
        ):
            raise ErroIngestao(f"contagens divergentes ao reprocessar snapshot {snapshot.id}")
        sessao.commit()
    except Exception:
        sessao.rollback()
        raise


@dataclass
class ResultadoReprocessamento:
    sucesso: list[int] = field(default_factory=list)
    falhas: dict[int, str] = field(default_factory=dict)


def deletar_snapshot(sessao: Session, snapshot_id: int) -> bool:
    """Remove um snapshot, suas observacoes/debitos (cascade), o arquivo bruto
    e qualquer `Entidade` que fique sem nenhuma observacao apos a remocao.

    Usado quando um upload precisa ser descartado por completo (ex.: arquivo
    gerado com um filtro incorreto) — ao contrario do fluxo normal de
    ingestao, aqui a remocao e definitiva e proposital: nao ha o que
    reprocessar de um arquivo que se sabe estar errado.
    """
    snapshot = sessao.get(Snapshot, snapshot_id)
    if snapshot is None:
        return False

    entidades_afetadas = set(
        sessao.scalars(
            select(ObservacaoEntidade.entidade_id).where(
                ObservacaoEntidade.snapshot_id == snapshot_id,
                ObservacaoEntidade.entidade_id.is_not(None),
            )
        ).all()
    )

    try:
        caminho = Path(snapshot.caminho_arquivo_bruto) if snapshot.caminho_arquivo_bruto else None
        sessao.delete(snapshot)
        sessao.flush()

        for entidade_id in entidades_afetadas:
            ainda_tem_observacao = sessao.scalar(
                select(ObservacaoEntidade.id).where(ObservacaoEntidade.entidade_id == entidade_id)
            )
            if ainda_tem_observacao is None:
                entidade_orfa = sessao.get(Entidade, entidade_id)
                if entidade_orfa is not None:
                    sessao.delete(entidade_orfa)

        sessao.commit()
    except Exception:
        sessao.rollback()
        raise

    if caminho is not None:
        caminho.unlink(missing_ok=True)
    return True


def reprocessar_todos_snapshots(sessao: Session) -> ResultadoReprocessamento:
    snapshots = sessao.scalars(select(Snapshot).order_by(Snapshot.id)).all()
    resultado = ResultadoReprocessamento()
    for snapshot in snapshots:
        try:
            reprocessar_snapshot(sessao, snapshot)
        except Exception as exc:
            resultado.falhas[snapshot.id] = str(exc)
        else:
            resultado.sucesso.append(snapshot.id)
    return resultado
