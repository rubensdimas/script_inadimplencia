from typing import Literal

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.db import get_sessao
from app.services.exports import (
    ExportacaoArquivo,
    gerar_exportacao_comparisons,
    gerar_exportacao_entities,
    gerar_exportacao_matching_issues,
    gerar_exportacao_ranking,
)
from app.services.snapshots import resolver_snapshot

roteador = APIRouter(prefix="/api/exports", tags=["exports"])

Dataset = Literal["ranking", "comparisons", "entities", "matching-issues"]


def _resposta_arquivo(arquivo: ExportacaoArquivo) -> Response:
    return Response(
        content=arquivo.conteudo,
        media_type=arquivo.media_type,
        headers={"Content-Disposition": f'attachment; filename="{arquivo.nome_arquivo}"'},
    )


@roteador.get("/{dataset}")
def exportar_dataset(
    dataset: Dataset,
    format: Literal["csv", "xlsx"] = Query(default="csv"),
    csv_snapshot_id: int | None = None,
    xlsx_snapshot_id: int | None = None,
    query: str | None = None,
    tipo_pessoa: str | None = None,
    situacao_registro: str | None = None,
    sessao: Session = Depends(get_sessao),
):
    if dataset == "entities":
        arquivo = gerar_exportacao_entities(
            sessao,
            query=query,
            tipo_pessoa=tipo_pessoa,
            situacao_registro=situacao_registro,
            formato=format,
        )
        return _resposta_arquivo(arquivo)

    csv_snapshot = resolver_snapshot(sessao, csv_snapshot_id, "csv")
    xlsx_snapshot = resolver_snapshot(sessao, xlsx_snapshot_id, "xlsx")

    if dataset == "ranking":
        arquivo = gerar_exportacao_ranking(
            sessao, csv_snapshot_id=csv_snapshot.id, xlsx_snapshot_id=xlsx_snapshot.id, formato=format
        )
    elif dataset == "comparisons":
        arquivo = gerar_exportacao_comparisons(
            sessao, csv_snapshot_id=csv_snapshot.id, xlsx_snapshot_id=xlsx_snapshot.id, formato=format
        )
    else:
        arquivo = gerar_exportacao_matching_issues(
            sessao, csv_snapshot_id=csv_snapshot.id, xlsx_snapshot_id=xlsx_snapshot.id, formato=format
        )

    return _resposta_arquivo(arquivo)
