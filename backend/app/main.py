from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.errors import ErroIngestao
from app.routers import analytics, entities, exports, snapshots, uploads

app = FastAPI(title="Inadimplência CREFITO11")
app.include_router(uploads.roteador)
app.include_router(snapshots.roteador)
app.include_router(analytics.roteador)
app.include_router(entities.roteador)
app.include_router(exports.roteador)


@app.exception_handler(ErroIngestao)
def tratar_erro_ingestao(_request: Request, exc: ErroIngestao):
    return JSONResponse(status_code=422, content={"detail": str(exc)})


@app.get("/health")
def health():
    return {"status": "ok"}
