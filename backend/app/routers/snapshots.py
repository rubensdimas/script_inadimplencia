from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.db import get_sessao
from app.models import Debito, ObservacaoEntidade, Snapshot
from app.schemas import PaginaDebitosOut, SnapshotOut
from app.services.ingestion import contar_debitos_do_snapshot

roteador = APIRouter(prefix="/api/snapshots", tags=["snapshots"])


@roteador.get("", response_model=list[SnapshotOut])
def listar_snapshots(
    tipo_arquivo: Literal["csv", "xlsx"] | None = None,
    sessao: Session = Depends(get_sessao),
):
    consulta = select(Snapshot).order_by(Snapshot.data_upload.desc(), Snapshot.id.desc())
    if tipo_arquivo is not None:
        consulta = consulta.where(Snapshot.tipo_arquivo == tipo_arquivo)
    return sessao.scalars(consulta).all()


@roteador.get("/{snapshot_id}/debitos", response_model=PaginaDebitosOut)
def listar_debitos(
    snapshot_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    sessao: Session = Depends(get_sessao),
):
    if sessao.get(Snapshot, snapshot_id) is None:
        raise HTTPException(status_code=404, detail="snapshot nao encontrado")

    filtro = ObservacaoEntidade.snapshot_id == snapshot_id
    total = contar_debitos_do_snapshot(sessao, snapshot_id)
    itens = sessao.scalars(
        select(Debito)
        .join(ObservacaoEntidade)
        .where(filtro)
        .options(joinedload(Debito.observacao))
        .order_by(Debito.id)
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return PaginaDebitosOut(
        items=itens,
        total=total,
        page=page,
        page_size=page_size,
        pages=(total + page_size - 1) // page_size,
    )
