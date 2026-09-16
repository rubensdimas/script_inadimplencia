from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db import get_sessao
from app.schemas import EntidadeDetalheOut, PaginaEntidadesOut
from app.services.entities import buscar_entidades, obter_entidade_detalhe

roteador = APIRouter(prefix="/api/entities", tags=["entities"])


@roteador.get("", response_model=PaginaEntidadesOut)
def listar_entidades(
    query: str | None = Query(default=None),
    tipo_pessoa: str | None = Query(default=None),
    situacao_registro: str | None = Query(default=None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    sessao: Session = Depends(get_sessao),
):
    return buscar_entidades(
        sessao,
        query=query,
        tipo_pessoa=tipo_pessoa,
        situacao_registro=situacao_registro,
        page=page,
        page_size=page_size,
    )


@roteador.get("/{entidade_id}", response_model=EntidadeDetalheOut)
def obter_entidade(entidade_id: int, sessao: Session = Depends(get_sessao)):
    detalhe = obter_entidade_detalhe(sessao, entidade_id)
    if detalhe is None:
        raise HTTPException(status_code=404, detail="entidade nao encontrada")
    return detalhe
