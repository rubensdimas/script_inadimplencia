from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.db import criar_tabelas
from app.routers import snapshots, uploads


@asynccontextmanager
async def lifespan(app: FastAPI):
    criar_tabelas()
    yield


app = FastAPI(title="Inadimplência CREFITO11", lifespan=lifespan)
app.include_router(uploads.roteador)
app.include_router(snapshots.roteador)


@app.get("/health")
def health():
    return {"status": "ok"}
