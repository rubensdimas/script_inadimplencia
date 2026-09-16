from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_sessao
from app.errors import ErroIngestao
from app.models import Snapshot
from app.schemas import ComparacaoOut, DashboardOut
from app.services.analytics import montar_comparacao, montar_dashboard

roteador = APIRouter(prefix="/api", tags=["analytics"])


def _resolver_snapshot(sessao: Session, snapshot_id: int | None, tipo_arquivo: str) -> Snapshot:
    if snapshot_id is None:
        snapshot = sessao.scalar(
            select(Snapshot)
            .where(Snapshot.tipo_arquivo == tipo_arquivo)
            .order_by(Snapshot.data_upload.desc(), Snapshot.id.desc())
        )
        if snapshot is None:
            raise HTTPException(status_code=404, detail=f"nenhum snapshot {tipo_arquivo} disponivel")
        return snapshot

    snapshot = sessao.get(Snapshot, snapshot_id)
    if snapshot is None:
        raise HTTPException(status_code=404, detail="snapshot nao encontrado")
    if snapshot.tipo_arquivo != tipo_arquivo:
        raise ErroIngestao(f"snapshot {snapshot_id} nao e do tipo {tipo_arquivo}")
    return snapshot


@roteador.get("/comparisons", response_model=ComparacaoOut)
def obter_comparacao(
    csv_snapshot_id: int | None = None,
    xlsx_snapshot_id: int | None = None,
    sessao: Session = Depends(get_sessao),
):
    csv_snapshot = _resolver_snapshot(sessao, csv_snapshot_id, "csv")
    xlsx_snapshot = _resolver_snapshot(sessao, xlsx_snapshot_id, "xlsx")
    return montar_comparacao(sessao, csv_snapshot.id, xlsx_snapshot.id)


@roteador.get("/dashboard", response_model=DashboardOut)
def obter_dashboard(
    csv_snapshot_id: int | None = None,
    xlsx_snapshot_id: int | None = None,
    sessao: Session = Depends(get_sessao),
):
    csv_snapshot = _resolver_snapshot(sessao, csv_snapshot_id, "csv")
    xlsx_snapshot = _resolver_snapshot(sessao, xlsx_snapshot_id, "xlsx")
    return montar_dashboard(sessao, csv_snapshot.id, xlsx_snapshot.id)
