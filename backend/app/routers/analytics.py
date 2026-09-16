from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_sessao
from app.schemas import ComparacaoOut, DashboardOut, PendenciasPareamentoOut
from app.services.analytics import montar_comparacao, montar_dashboard, montar_pendencias_pareamento
from app.services.snapshots import resolver_snapshot

roteador = APIRouter(prefix="/api", tags=["analytics"])

# Teto de itens em ranking_obrigacoes/ranking_valor_total/divida_ativa na resposta
# JSON do dashboard (a exportacao, que chama montar_dashboard com limite=None,
# continua sem teto -- ver app/services/analytics.py:montar_dashboard).
LIMITE_DASHBOARD_JSON = 50


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
    return montar_dashboard(sessao, csv_snapshot.id, xlsx_snapshot.id, limite=LIMITE_DASHBOARD_JSON)


@roteador.get("/matching-issues", response_model=PendenciasPareamentoOut)
def obter_pendencias_pareamento(
    csv_snapshot_id: int | None = None,
    xlsx_snapshot_id: int | None = None,
    sessao: Session = Depends(get_sessao),
):
    csv_snapshot = resolver_snapshot(sessao, csv_snapshot_id, "csv")
    xlsx_snapshot = resolver_snapshot(sessao, xlsx_snapshot_id, "xlsx")
    return montar_pendencias_pareamento(sessao, csv_snapshot.id, xlsx_snapshot.id)
