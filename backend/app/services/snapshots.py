"""Resolucao do snapshot-alvo para endpoints que aceitam `snapshot_id` opcional.

Convencao unica reutilizada por comparisons/dashboard/matching-issues/exports:
quando `snapshot_id` e omitido, usa o snapshot mais recente daquele tipo
(`data_upload` desc, `id` desc); quando informado, valida existencia (404) e
tipo (422 via `ErroIngestao`).
"""

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.errors import ErroIngestao
from app.models import Snapshot


def resolver_snapshot(sessao: Session, snapshot_id: int | None, tipo_arquivo: str) -> Snapshot:
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
