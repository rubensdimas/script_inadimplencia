from fastapi import FastAPI

app = FastAPI(title="Inadimplência CREFITO11")


@app.get("/health")
def health():
    return {"status": "ok"}
