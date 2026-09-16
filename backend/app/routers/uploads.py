from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.orm import Session

from app.db import get_sessao
from app.schemas import SnapshotOut
from app.services.ingestion import ingerir_csv, ingerir_xlsx

roteador = APIRouter(prefix="/api/uploads", tags=["uploads"])


@roteador.post("/csv", response_model=SnapshotOut, status_code=201)
async def upload_csv(arquivo: UploadFile = File(...), sessao: Session = Depends(get_sessao)):
    conteudo = await arquivo.read()
    return ingerir_csv(sessao, arquivo.filename or "upload.csv", conteudo)


@roteador.post("/xlsx", response_model=SnapshotOut, status_code=201)
async def upload_xlsx(arquivo: UploadFile = File(...), sessao: Session = Depends(get_sessao)):
    conteudo = await arquivo.read()
    return ingerir_xlsx(sessao, arquivo.filename or "upload.xlsx", conteudo)
