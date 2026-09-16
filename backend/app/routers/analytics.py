from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_sessao
from app.schemas import ComparacaoOut, DashboardOut, PendenciasPareamentoOut
from app.services.analytics import montar_comparacao, montar_dashboard, montar_pendencias_pareamento
from app.services.snapshots import resolver_snapshot

roteador = APIRouter(prefix="/api", tags=["analytics"])


@roteador.get("/comparisons", response_model=ComparacaoOut)
def obter_comparacao(
    csv_snapshot_id: int | None = None,
    xlsx_snapshot_id: int | None = None,
    sessao: Session = Depends(get_sessao),
):
    csv_snapshot = resolver_snapshot(sessao, csv_snapshot_id, "csv")
    xlsx_snapshot = resolver_snapshot(sessao, xlsx_snapshot_id, "xlsx")
    return montar_comparacao(sessao, csv_snapshot.id, xlsx_snapshot.id)


@roteador.get("/dashboard", response_model=DashboardOut)
def obter_dashboard(
    csv_snapshot_id: int | None = None,
    xlsx_snapshot_id: int | None = None,
    sessao: Session = Depends(get_sessao),
):
    csv_snapshot = resolver_snapshot(sessao, csv_snapshot_id, "csv")
    xlsx_snapshot = resolver_snapshot(sessao, xlsx_snapshot_id, "xlsx")
    return montar_dashboard(sessao, csv_snapshot.id, xlsx_snapshot.id)


@roteador.get("/matching-issues", response_model=PendenciasPareamentoOut)
def obter_pendencias_pareamento(
    csv_snapshot_id: int | None = None,
    xlsx_snapshot_id: int | None = None,
    sessao: Session = Depends(get_sessao),
):
    csv_snapshot = resolver_snapshot(sessao, csv_snapshot_id, "csv")
    xlsx_snapshot = resolver_snapshot(sessao, xlsx_snapshot_id, "xlsx")
    return montar_pendencias_pareamento(sessao, csv_snapshot.id, xlsx_snapshot.id)
