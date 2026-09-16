from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.db import get_sessao
from app.models import Debito, Snapshot
from app.schemas import DebitoOut, SnapshotOut

roteador = APIRouter(prefix="/snapshots", tags=["snapshots"])


@roteador.get("", response_model=list[SnapshotOut])
def listar_snapshots(sessao: Session = Depends(get_sessao)):
    return sessao.scalars(select(Snapshot).order_by(Snapshot.data_upload.desc())).all()


@roteador.get("/{snapshot_id}/debitos", response_model=list[DebitoOut])
def listar_debitos(snapshot_id: int, sessao: Session = Depends(get_sessao)):
    return sessao.scalars(
        select(Debito)
        .where(Debito.snapshot_id == snapshot_id)
        .options(joinedload(Debito.entidade))
        .order_by(Debito.id)
    ).all()
