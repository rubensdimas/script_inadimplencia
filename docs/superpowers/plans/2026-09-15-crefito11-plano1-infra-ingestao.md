# CREFITO11 — Plano 1/3: Infraestrutura, Modelo de Dados e Ingestão Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Subir o esqueleto Docker Compose (Postgres + FastAPI + frontend placeholder), criar o modelo de dados (`snapshots`, `entidades`, `debitos`) e implementar os dois endpoints de upload (CSV e XLSX) que fazem parsing, normalização de nomes e persistência como snapshot histórico — produzindo um sistema já demonstrável ponta-a-ponta: subir os containers, enviar os dois arquivos reais e consultar o que foi persistido via API.

**Architecture:** Backend FastAPI + SQLAlchemy 2.0 (sync) sobre PostgreSQL, rodando em Docker Compose junto com um frontend React/Vite placeholder (ainda sem telas reais — isso é o Plano 3). Parsing de CSV via `csv` da stdlib (encoding `latin-1`, sem cabeçalho, 6 colunas fixas). Parsing de XLSX via `openpyxl` lendo a aba única "Dados", despivotando os blocos repetidos `Debitos.N.*` (N de 0 a 36) para uma linha de débito por bloco preenchido. Normalização de nome (NFKD + maiúsculo + colapso de espaços) é a chave única de pareamento de `entidades`, compartilhada entre os dois parsers.

**Tech Stack:** Docker Compose, PostgreSQL 16, Python 3.12, FastAPI, SQLAlchemy 2.0, psycopg2-binary, openpyxl, pytest + httpx (`TestClient`), React 18 + Vite + TypeScript (placeholder neste plano).

**Spec:** `docs/specs/001-analise-inadimplencia-crefito11.md`

**Escopo deste plano (1 de 3):** Este spec cobre um sistema completo (ingestão + comparação/rankings + dashboard). Ele foi dividido em 3 planos independentes, cada um produzindo software testável por si só:
- **Plano 1 (este)**: infraestrutura, modelo de dados, upload/parsing/persistência de CSV e XLSX.
- **Plano 2** (a escrever depois que este for executado): motor de comparação entre snapshots, rankings, indicadores, evolução histórica, pendências de pareamento, exportação.
- **Plano 3** (a escrever depois do Plano 2): frontend real — telas de Upload, Dashboard, Tabela de entidades, Pendências, mascaramento de CPF/CNPJ, exportação na UI.

## Global Constraints

- Sistema roda inteiramente via Docker Compose, uso local de uma única pessoa, sem autenticação.
- CSV: encoding `ISO-8859-1`/`latin-1`, separador `;`, sem cabeçalho, 6 colunas fixas: nome; tipo de débito; ano de referência; número da parcela; data de vencimento (`DD/MM/YYYY`); status (`Débito`/`Parcelamento`).
- XLSX: aba única chamada `Dados`; 6 colunas cadastrais usadas (`CPFCNPJ`, `NomeRazaoSocial`, `TipoPessoa`, `Categoria`, `SubRegiao`, `SituacaoRegistro`) + blocos repetidos `Debitos.N.*` (N de 0 a 36) despivotados em linhas de débito individuais.
- Normalização de nome (maiúsculo, sem acentuação via NFKD, espaços colapsados) é a **única** chave de pareamento entre entidades — usar sempre a mesma função compartilhada.
- Nenhum registro é filtrado por tipo de pessoa (Profissional/Empresa) — todos entram no modelo.
- CPF/CNPJ completo é sempre persistido no banco; mascaramento é responsabilidade da camada de apresentação (fora do escopo deste plano).
- Seam único de teste: testes de integração via `TestClient`/`httpx` batendo nos endpoints reais da API, contra um PostgreSQL de teste efêmero via Docker. **Não** escrever testes unitários isolados para funções internas de parsing/matching (`parse_csv`, `parse_xlsx`, `normalize_nome`) — isso é implementação, não contrato.
- Sem correspondência aproximada (fuzzy matching) de nomes.
- Sem Alembic/migrações — schema criado via `Base.metadata.create_all()` no startup (aplicação local de uso único, sem múltiplos ambientes).

---

## Estrutura de Arquivos

```
docker-compose.yml
docker-compose.test.yml
.env.example
.gitignore

backend/
  Dockerfile
  requirements.txt
  app/
    __init__.py
    main.py
    db.py
    models.py
    schemas.py
    normalize.py
    snapshot_date.py
    parsers/
      __init__.py
      csv_parser.py
      xlsx_parser.py
    services/
      __init__.py
      ingestion.py
    routers/
      __init__.py
      uploads.py
      snapshots.py
  tests/
    conftest.py
    fixture_builders.py
    test_health.py
    test_upload_csv.py
    test_upload_xlsx.py

frontend/
  Dockerfile
  package.json
  tsconfig.json
  vite.config.ts
  index.html
  src/
    main.tsx
    App.tsx
```

- `app/models.py`: as 3 tabelas do modelo de dados (`Snapshot`, `Entidade`, `Debito`).
- `app/normalize.py` + `app/snapshot_date.py`: as duas funções puras e compartilhadas (normalização de nome; extração de data de snapshot a partir do nome do arquivo).
- `app/parsers/*`: um parser por formato de arquivo, cada um devolvendo dataclasses simples (sem tocar no banco).
- `app/services/ingestion.py`: orquestra parser → normalização → upsert de entidade → persistência de débitos → snapshot, para os dois formatos.
- `app/routers/*`: só HTTP — recebem upload, chamam o service, devolvem o schema de resposta.

---

### Task 1: Scaffolding do projeto — Docker Compose, backend mínimo, frontend placeholder

**Files:**
- Create: `docker-compose.yml`
- Create: `.env.example`
- Create: `.gitignore`
- Create: `backend/Dockerfile`
- Create: `backend/requirements.txt`
- Create: `backend/app/__init__.py`
- Create: `backend/app/main.py`
- Create: `backend/tests/test_health.py`
- Create: `frontend/Dockerfile`
- Create: `frontend/package.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`

**Interfaces:**
- Produces: `app = FastAPI(...)` importável como `app.main:app`; endpoint `GET /health` → `{"status": "ok"}`; topologia Docker Compose com serviços `db`, `backend`, `frontend`.

- [ ] **Step 1: Escrever o teste do health check**

`backend/tests/test_health.py`:
```python
from fastapi.testclient import TestClient

from app.main import app


def test_health_retorna_ok():
    cliente = TestClient(app)
    resposta = cliente.get("/health")

    assert resposta.status_code == 200
    assert resposta.json() == {"status": "ok"}
```

- [ ] **Step 2: Criar o backend mínimo**

`backend/requirements.txt`:
```
fastapi==0.115.0
uvicorn[standard]==0.30.6
pytest==8.3.3
httpx==0.27.2
```

`backend/app/__init__.py`:
```python
```

`backend/app/main.py`:
```python
from fastapi import FastAPI

app = FastAPI(title="Inadimplência CREFITO11")


@app.get("/health")
def health():
    return {"status": "ok"}
```

`backend/Dockerfile`:
```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

- [ ] **Step 3: Criar o frontend placeholder**

`frontend/package.json`:
```json
{
  "name": "frontend",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite --host 0.0.0.0",
    "build": "tsc -b && vite build",
    "preview": "vite preview --host 0.0.0.0"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.5",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "typescript": "^5.5.4",
    "vite": "^5.4.6"
  }
}
```

`frontend/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true
  },
  "include": ["src"]
}
```

`frontend/vite.config.ts`:
```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
  },
});
```

`frontend/index.html`:
```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <title>Inadimplência CREFITO11</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`frontend/src/main.tsx`:
```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

`frontend/src/App.tsx`:
```tsx
function App() {
  return (
    <main>
      <h1>Inadimplência CREFITO11</h1>
      <p>Dashboard em construção.</p>
    </main>
  );
}

export default App;
```

`frontend/Dockerfile`:
```dockerfile
FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

CMD ["npm", "run", "dev"]
```

- [ ] **Step 4: Criar o Docker Compose e arquivos de suporte**

`docker-compose.yml`:
```yaml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-inadimplencia}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-inadimplencia}
      POSTGRES_DB: ${POSTGRES_DB:-inadimplencia}
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  backend:
    build: ./backend
    environment:
      DATABASE_URL: postgresql+psycopg2://${POSTGRES_USER:-inadimplencia}:${POSTGRES_PASSWORD:-inadimplencia}@db:5432/${POSTGRES_DB:-inadimplencia}
      RAW_UPLOADS_DIR: /data/raw_uploads
    volumes:
      - raw_uploads:/data/raw_uploads
    ports:
      - "8000:8000"
    depends_on:
      - db

  frontend:
    build: ./frontend
    ports:
      - "5173:5173"
    depends_on:
      - backend

volumes:
  pgdata:
  raw_uploads:
```

`docker-compose.test.yml` (override usado só para rodar testes de integração, criado aqui vazio de serviço de app — o serviço `db-test` real entra na Task 2, quando existe algo que precise dele):
```yaml
services:
  db-test:
    image: postgres:16
    environment:
      POSTGRES_USER: inadimplencia_test
      POSTGRES_PASSWORD: inadimplencia_test
      POSTGRES_DB: inadimplencia_test
    ports:
      - "55432:5432"
    tmpfs:
      - /var/lib/postgresql/data
```

`.env.example`:
```
POSTGRES_USER=inadimplencia
POSTGRES_PASSWORD=inadimplencia
POSTGRES_DB=inadimplencia
```

`.gitignore`:
```
__pycache__/
*.pyc
node_modules/
.env

# Relatórios brutos de inadimplência contêm CPF/CNPJ e dados financeiros reais —
# nunca versionar, só usar como entrada local para upload manual.
Relatorio de inadimplencia - Analitico.csv
Relatorio_Inadimplentes_Debitos_*.xlsx
```

- [ ] **Step 5: Rodar o teste de health check e confirmar que passa**

Run: `docker compose build backend && docker compose run --rm backend pytest tests/test_health.py -v`
Expected: PASS — `test_health_retorna_ok`.

- [ ] **Step 6: Subir os 3 containers e verificar manualmente**

Run: `docker compose up -d`
Run: `curl http://localhost:8000/health`
Expected: `{"status":"ok"}`
Abrir `http://localhost:5173` no navegador — deve mostrar a página "Inadimplência CREFITO11 — Dashboard em construção.".
Run: `docker compose down`

- [ ] **Step 7: Commit**

```bash
git add docker-compose.yml docker-compose.test.yml .env.example .gitignore backend frontend
git commit -m "feat: scaffolding do projeto (docker compose, backend health check, frontend placeholder)"
```

---

### Task 2: Modelo de dados, normalização e ingestão de CSV

**Files:**
- Create: `docker-compose.test.yml` (modificar — nada a mudar aqui de fato, o `db-test` já existe da Task 1; listado por completude)
- Modify: `backend/requirements.txt`
- Create: `backend/app/db.py`
- Create: `backend/app/models.py`
- Create: `backend/app/schemas.py`
- Create: `backend/app/normalize.py`
- Create: `backend/app/snapshot_date.py`
- Create: `backend/app/parsers/__init__.py`
- Create: `backend/app/parsers/csv_parser.py`
- Create: `backend/app/services/__init__.py`
- Create: `backend/app/services/ingestion.py`
- Create: `backend/app/routers/__init__.py`
- Create: `backend/app/routers/uploads.py`
- Create: `backend/app/routers/snapshots.py`
- Modify: `backend/app/main.py`
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/test_upload_csv.py`

**Interfaces:**
- Consumes: `app = FastAPI(...)` de `backend/app/main.py` (Task 1); serviço `db-test` do `docker-compose.test.yml` (Task 1).
- Produces: modelos `Snapshot`, `Entidade`, `Debito` em `app/models.py`; `normalize_nome(raw: str) -> str`; `extrair_data_snapshot(nome_arquivo: str, data_upload: datetime) -> datetime`; `parse_csv(conteudo: bytes) -> list[RegistroCsv]`; `ingerir_csv(sessao, nome_arquivo: str, conteudo: bytes) -> Snapshot`; endpoints `POST /uploads/csv`, `GET /snapshots`, `GET /snapshots/{snapshot_id}/debitos`; schemas `SnapshotOut`, `EntidadeResumoOut`, `DebitoOut`; fixture de teste `cliente` em `tests/conftest.py`.

- [ ] **Step 1: Escrever o teste de integração do upload de CSV**

`backend/tests/test_upload_csv.py`:
```python
from datetime import datetime, timezone


def test_upload_csv_cria_snapshot_normaliza_nomes_e_persiste_debitos(cliente):
    conteudo = (
        "JOÃO DA SILVA;ANUIDADE;2024;0;15/03/2024;Débito\n"
        "JOÃO   DA  SILVA;ANUIDADE;2023;1;10/01/2023;Parcelamento\n"
        "JOAO DA SILVA;ANUIDADE;2023;2;10/02/2023;Parcelamento\n"
        "MARIA OLIVEIRA COSTA;ANUIDADE;2022;0;20/05/2022;Débito\n"
    ).encode("latin-1")

    resposta = cliente.post(
        "/uploads/csv",
        files={"arquivo": ("relatorio.csv", conteudo, "text/csv")},
    )

    assert resposta.status_code == 201
    snapshot = resposta.json()
    assert snapshot["tipo_arquivo"] == "csv"
    assert snapshot["nome_arquivo_original"] == "relatorio.csv"

    data_snapshot = datetime.fromisoformat(snapshot["data_snapshot"])
    agora = datetime.now(timezone.utc).replace(tzinfo=None)
    assert abs((agora - data_snapshot).total_seconds()) < 30

    snapshots = cliente.get("/snapshots").json()
    assert any(s["id"] == snapshot["id"] for s in snapshots)

    debitos = cliente.get(f"/snapshots/{snapshot['id']}/debitos").json()
    assert len(debitos) == 4

    entidade_joao_1 = debitos[0]["entidade"]["id"]
    entidade_joao_2 = debitos[1]["entidade"]["id"]
    entidade_joao_3 = debitos[2]["entidade"]["id"]
    entidade_maria = debitos[3]["entidade"]["id"]

    assert entidade_joao_1 == entidade_joao_2 == entidade_joao_3
    assert entidade_maria != entidade_joao_1
    assert debitos[0]["entidade"]["nome_normalizado"] == "JOAO DA SILVA"
    assert debitos[2]["entidade"]["nome_original"] == "JOAO DA SILVA"

    maria = debitos[3]
    assert maria["ano_referencia"] == 2022
    assert maria["numero_parcela"] == 0
    assert maria["situacao_parcelamento"] == "Débito"
    assert maria["data_vencimento"] == "2022-05-20"
    assert maria["origem"] == "csv"

    parcela = debitos[1]
    assert parcela["numero_parcela"] == 1
    assert parcela["situacao_parcelamento"] == "Parcelamento"
    assert parcela["data_vencimento"] == "2023-01-10"
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Pré-requisito (uma vez, antes de qualquer rodada de testes): `docker compose -f docker-compose.yml -f docker-compose.test.yml up -d db-test`

Run:
```bash
docker compose -f docker-compose.yml -f docker-compose.test.yml run --rm \
  -e DATABASE_URL=postgresql+psycopg2://inadimplencia_test:inadimplencia_test@db-test:5432/inadimplencia_test \
  -e RAW_UPLOADS_DIR=/tmp/raw_uploads_teste \
  backend pytest tests/test_upload_csv.py -v
```
Expected: FAIL — `ModuleNotFoundError` ou `ImportError` (conftest ainda não existe, rota `/uploads/csv` ainda não existe).

- [ ] **Step 3: Adicionar dependências de banco e upload ao `requirements.txt`**

`backend/requirements.txt`:
```
fastapi==0.115.0
uvicorn[standard]==0.30.6
pytest==8.3.3
httpx==0.27.2
sqlalchemy==2.0.35
psycopg2-binary==2.9.9
python-multipart==0.0.12
```

- [ ] **Step 4: Criar o modelo de dados**

`backend/app/models.py`:
```python
from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Snapshot(Base):
    __tablename__ = "snapshots"

    id: Mapped[int] = mapped_column(primary_key=True)
    tipo_arquivo: Mapped[str] = mapped_column(String(10))
    nome_arquivo_original: Mapped[str] = mapped_column(String(255))
    caminho_arquivo_bruto: Mapped[str] = mapped_column(String(500))
    data_snapshot: Mapped[datetime] = mapped_column(DateTime)
    data_upload: Mapped[datetime] = mapped_column(DateTime)

    debitos: Mapped[list["Debito"]] = relationship(back_populates="snapshot")


class Entidade(Base):
    __tablename__ = "entidades"

    id: Mapped[int] = mapped_column(primary_key=True)
    nome_normalizado: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    nome_original: Mapped[str] = mapped_column(String(255))
    cpf_cnpj: Mapped[str | None] = mapped_column(String(20), nullable=True)
    tipo_pessoa: Mapped[str | None] = mapped_column(String(20), nullable=True)
    categoria: Mapped[str | None] = mapped_column(String(50), nullable=True)
    subregiao: Mapped[str | None] = mapped_column(String(100), nullable=True)
    situacao_registro: Mapped[str | None] = mapped_column(String(50), nullable=True)

    debitos: Mapped[list["Debito"]] = relationship(back_populates="entidade")


class Debito(Base):
    __tablename__ = "debitos"

    id: Mapped[int] = mapped_column(primary_key=True)
    snapshot_id: Mapped[int] = mapped_column(ForeignKey("snapshots.id"))
    entidade_id: Mapped[int] = mapped_column(ForeignKey("entidades.id"))
    origem: Mapped[str] = mapped_column(String(10))
    ano_referencia: Mapped[int] = mapped_column(Integer)
    tipo_debito: Mapped[str] = mapped_column(String(50))
    numero_parcela: Mapped[int | None] = mapped_column(Integer, nullable=True)
    data_vencimento: Mapped[date | None] = mapped_column(Date, nullable=True)
    valor_original: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    valor_devido: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    valor_total: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    situacao_pagamento: Mapped[str | None] = mapped_column(String(50), nullable=True)
    situacao_divida_ativa: Mapped[str | None] = mapped_column(String(50), nullable=True)
    situacao_parcelamento: Mapped[str | None] = mapped_column(String(50), nullable=True)

    snapshot: Mapped["Snapshot"] = relationship(back_populates="debitos")
    entidade: Mapped["Entidade"] = relationship(back_populates="debitos")
```

- [ ] **Step 5: Criar a conexão com o banco**

`backend/app/db.py`:
```python
import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models import Base

engine = create_engine(os.environ["DATABASE_URL"])
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def criar_tabelas() -> None:
    Base.metadata.create_all(bind=engine)


def get_sessao():
    sessao = SessionLocal()
    try:
        yield sessao
    finally:
        sessao.close()
```

- [ ] **Step 6: Criar a normalização de nome e a extração de data de snapshot**

`backend/app/normalize.py`:
```python
import unicodedata


def normalize_nome(bruto: str) -> str:
    sem_acento = unicodedata.normalize("NFKD", bruto).encode("ascii", "ignore").decode("ascii")
    return " ".join(sem_acento.upper().split())
```

`backend/app/snapshot_date.py`:
```python
import re
from datetime import datetime

_PADRAO_TIMESTAMP = re.compile(r"(\d{8}_\d{6})")


def extrair_data_snapshot(nome_arquivo: str, data_upload: datetime) -> datetime:
    correspondencia = _PADRAO_TIMESTAMP.search(nome_arquivo)
    if not correspondencia:
        return data_upload
    return datetime.strptime(correspondencia.group(1), "%Y%m%d_%H%M%S")
```

- [ ] **Step 7: Criar o parser de CSV**

`backend/app/parsers/__init__.py`:
```python
```

`backend/app/parsers/csv_parser.py`:
```python
import csv
from dataclasses import dataclass
from datetime import date, datetime
from io import StringIO


@dataclass
class RegistroCsv:
    nome_original: str
    tipo_debito: str
    ano_referencia: int
    numero_parcela: int
    data_vencimento: date
    situacao_parcelamento: str


def parse_csv(conteudo: bytes) -> list[RegistroCsv]:
    texto = conteudo.decode("latin-1")
    leitor = csv.reader(StringIO(texto), delimiter=";")
    registros = []
    for linha in leitor:
        if not linha or not linha[0].strip():
            continue
        nome, tipo_debito, ano, parcela, vencimento, status = linha
        registros.append(
            RegistroCsv(
                nome_original=nome.strip(),
                tipo_debito=tipo_debito.strip(),
                ano_referencia=int(ano),
                numero_parcela=int(parcela),
                data_vencimento=datetime.strptime(vencimento.strip(), "%d/%m/%Y").date(),
                situacao_parcelamento=status.strip(),
            )
        )
    return registros
```

- [ ] **Step 8: Criar o serviço de ingestão**

`backend/app/services/__init__.py`:
```python
```

`backend/app/services/ingestion.py`:
```python
import os
from datetime import datetime
from pathlib import Path

from sqlalchemy.orm import Session

from app.models import Debito, Entidade, Snapshot
from app.normalize import normalize_nome
from app.parsers.csv_parser import parse_csv
from app.snapshot_date import extrair_data_snapshot


def _raw_uploads_dir() -> Path:
    return Path(os.environ.get("RAW_UPLOADS_DIR", "/data/raw_uploads"))


def _buscar_ou_criar_entidade(
    sessao: Session,
    cache: dict[str, Entidade],
    nome_original: str,
    extras: dict[str, str | None] | None = None,
) -> Entidade:
    nome_normalizado = normalize_nome(nome_original)
    entidade = cache.get(nome_normalizado)
    if entidade is None:
        entidade = sessao.query(Entidade).filter_by(nome_normalizado=nome_normalizado).one_or_none()
    if entidade is None:
        entidade = Entidade(nome_normalizado=nome_normalizado, nome_original=nome_original)
        sessao.add(entidade)
        sessao.flush()
    else:
        entidade.nome_original = nome_original

    if extras:
        for campo, valor in extras.items():
            if valor is not None:
                setattr(entidade, campo, valor)

    cache[nome_normalizado] = entidade
    return entidade


def _criar_snapshot(sessao: Session, tipo_arquivo: str, nome_arquivo: str, conteudo: bytes) -> Snapshot:
    agora = datetime.utcnow()
    snapshot = Snapshot(
        tipo_arquivo=tipo_arquivo,
        nome_arquivo_original=nome_arquivo,
        caminho_arquivo_bruto="",
        data_snapshot=extrair_data_snapshot(nome_arquivo, agora),
        data_upload=agora,
    )
    sessao.add(snapshot)
    sessao.flush()

    diretorio = _raw_uploads_dir()
    diretorio.mkdir(parents=True, exist_ok=True)
    caminho = diretorio / f"{snapshot.id}_{nome_arquivo}"
    caminho.write_bytes(conteudo)
    snapshot.caminho_arquivo_bruto = str(caminho)

    return snapshot


def ingerir_csv(sessao: Session, nome_arquivo: str, conteudo: bytes) -> Snapshot:
    snapshot = _criar_snapshot(sessao, "csv", nome_arquivo, conteudo)

    cache_entidades: dict[str, Entidade] = {}
    for registro in parse_csv(conteudo):
        entidade = _buscar_ou_criar_entidade(sessao, cache_entidades, registro.nome_original)
        sessao.add(
            Debito(
                snapshot_id=snapshot.id,
                entidade_id=entidade.id,
                origem="csv",
                ano_referencia=registro.ano_referencia,
                tipo_debito=registro.tipo_debito,
                numero_parcela=registro.numero_parcela,
                data_vencimento=registro.data_vencimento,
                situacao_parcelamento=registro.situacao_parcelamento,
            )
        )

    sessao.commit()
    sessao.refresh(snapshot)
    return snapshot
```

- [ ] **Step 9: Criar os schemas de resposta**

`backend/app/schemas.py`:
```python
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class SnapshotOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    tipo_arquivo: str
    nome_arquivo_original: str
    data_snapshot: datetime
    data_upload: datetime


class EntidadeResumoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nome_normalizado: str
    nome_original: str
    cpf_cnpj: str | None
    tipo_pessoa: str | None
    categoria: str | None
    subregiao: str | None
    situacao_registro: str | None


class DebitoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    origem: str
    ano_referencia: int
    tipo_debito: str
    numero_parcela: int | None
    data_vencimento: date | None
    valor_original: float | None
    valor_devido: float | None
    valor_total: float | None
    situacao_pagamento: str | None
    situacao_divida_ativa: str | None
    situacao_parcelamento: str | None
    entidade: EntidadeResumoOut
```

- [ ] **Step 10: Criar os routers de upload e snapshots**

`backend/app/routers/__init__.py`:
```python
```

`backend/app/routers/uploads.py`:
```python
from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.orm import Session

from app.db import get_sessao
from app.schemas import SnapshotOut
from app.services.ingestion import ingerir_csv

roteador = APIRouter(prefix="/uploads", tags=["uploads"])


@roteador.post("/csv", response_model=SnapshotOut, status_code=201)
async def upload_csv(arquivo: UploadFile = File(...), sessao: Session = Depends(get_sessao)):
    conteudo = await arquivo.read()
    return ingerir_csv(sessao, arquivo.filename, conteudo)
```

`backend/app/routers/snapshots.py`:
```python
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.db import get_sessao
from app.models import Debito, Snapshot
from app.schemas import DebitoOut, SnapshotOut

roteador = APIRouter(prefix="/snapshots", tags=["snapshots"])


@roteador.get("", response_model=list[SnapshotOut])
def listar_snapshots(sessao: Session = Depends(get_sessao)):
    return sessao.scalars(select(Snapshot).order_by(Snapshot.data_upload.desc())).all()


@roteador.get("/{snapshot_id}/debitos", response_model=list[DebitoOut])
def listar_debitos(snapshot_id: int, sessao: Session = Depends(get_sessao)):
    return sessao.scalars(
        select(Debito)
        .where(Debito.snapshot_id == snapshot_id)
        .options(joinedload(Debito.entidade))
        .order_by(Debito.id)
    ).all()
```

- [ ] **Step 11: Ligar tudo em `main.py`**

`backend/app/main.py`:
```python
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
```

- [ ] **Step 12: Criar a fixture de teste com banco real**

`backend/tests/conftest.py`:
```python
import pytest
from fastapi.testclient import TestClient

from app.db import engine
from app.main import app
from app.models import Base


@pytest.fixture()
def cliente():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with TestClient(app) as cliente:
        yield cliente
```

- [ ] **Step 13: Rodar os testes e confirmar que passam**

Run:
```bash
docker compose build backend
docker compose -f docker-compose.yml -f docker-compose.test.yml run --rm \
  -e DATABASE_URL=postgresql+psycopg2://inadimplencia_test:inadimplencia_test@db-test:5432/inadimplencia_test \
  -e RAW_UPLOADS_DIR=/tmp/raw_uploads_teste \
  backend pytest -v
```
Expected: PASS — `test_health_retorna_ok` e `test_upload_csv_cria_snapshot_normaliza_nomes_e_persiste_debitos`.

- [ ] **Step 14: Commit**

```bash
git add backend docker-compose.test.yml
git commit -m "feat: modelo de dados, normalizacao de nomes e ingestao de CSV"
```

---

### Task 3: Ingestão de XLSX (despivot dos blocos de débito)

**Files:**
- Modify: `backend/requirements.txt`
- Create: `backend/app/parsers/xlsx_parser.py`
- Modify: `backend/app/services/ingestion.py`
- Modify: `backend/app/routers/uploads.py`
- Create: `backend/tests/fixture_builders.py`
- Create: `backend/tests/test_upload_xlsx.py`

**Interfaces:**
- Consumes: `_criar_snapshot`, `_buscar_ou_criar_entidade`, `normalize_nome`, `extrair_data_snapshot` de `app/services/ingestion.py` (Task 2); modelos `Snapshot`, `Entidade`, `Debito` (Task 2); schemas `SnapshotOut`, `DebitoOut`, `EntidadeResumoOut` (Task 2, inalterados); fixture `cliente` (Task 2).
- Produces: `parse_xlsx(conteudo: bytes) -> list[RegistroXlsx]` em `app/parsers/xlsx_parser.py`; `ingerir_xlsx(sessao, nome_arquivo: str, conteudo: bytes) -> Snapshot` em `app/services/ingestion.py`; endpoint `POST /uploads/xlsx`; `construir_xlsx_fixture() -> bytes` em `tests/fixture_builders.py`.

- [ ] **Step 1: Escrever o construtor de fixture XLSX**

`backend/tests/fixture_builders.py`:
```python
from datetime import date
from io import BytesIO

from openpyxl import Workbook

COLUNAS_FIXAS = ["CPFCNPJ", "NomeRazaoSocial", "TipoPessoa", "Categoria", "SubRegiao", "SituacaoRegistro"]
COLUNAS_DEBITO = [
    "AnoReferencia",
    "DebitoTipo",
    "DataVencimento",
    "ValorOriginal",
    "ValorDevido",
    "ValorTotal",
    "DebitoSituacaoPagamentoNome",
    "DebitoSituacaoDividaAtivaNome",
    "DebitoSituacaoParcelamentoNome",
]


def construir_xlsx_fixture() -> bytes:
    pasta = Workbook()
    aba = pasta.active
    aba.title = "Dados"

    cabecalho = COLUNAS_FIXAS + [
        f"Debitos.{n}.{campo}" for n in range(2) for campo in COLUNAS_DEBITO
    ]
    aba.append(cabecalho)

    aba.append(
        [
            "10.852.801/0001-39", "3 ID FISIOTERAPIA LTDA", "Empresa", "EMPRESA",
            "DISTRITO FEDERAL", "ATIVO",
            2026, "ANUIDADE", date(2026, 4, 30), 577.0, 577.0, 620.27,
            "Não pago", "Administrativa", "Não parcelado",
            None, None, None, None, None, None, None, None, None,
        ]
    )
    aba.append(
        [
            "61.356.447/0001-92", "LUCAS SOARES MAIA", "Profissional", "PROFISSIONAL",
            "DISTRITO FEDERAL", "BAIXADO",
            2026, "ANUIDADE", date(2026, 4, 30), 577.0, 504.87, 542.73,
            "Pago a menor", "Executiva", "Renegociado",
            None, None, None, None, None, None, None, None, None,
        ]
    )

    for linha in aba.iter_rows(min_row=2):
        for celula in linha:
            if isinstance(celula.value, date):
                celula.number_format = "dd/mm/yyyy"

    saida = BytesIO()
    pasta.save(saida)
    return saida.getvalue()
```

- [ ] **Step 2: Escrever o teste de integração do upload de XLSX**

`backend/tests/test_upload_xlsx.py`:
```python
from tests.fixture_builders import construir_xlsx_fixture


def test_upload_xlsx_despivota_debitos_e_persiste_dados_cadastrais(cliente):
    conteudo = construir_xlsx_fixture()

    resposta = cliente.post(
        "/uploads/xlsx",
        files={
            "arquivo": (
                "Relatorio_Inadimplentes_Debitos_20260915_205007.xlsx",
                conteudo,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )

    assert resposta.status_code == 201
    snapshot = resposta.json()
    assert snapshot["tipo_arquivo"] == "xlsx"
    assert snapshot["data_snapshot"].startswith("2026-09-15T20:50:07")

    debitos = cliente.get(f"/snapshots/{snapshot['id']}/debitos").json()
    assert len(debitos) == 2

    empresa = next(d for d in debitos if d["valor_total"] == 620.27)
    assert empresa["origem"] == "xlsx"
    assert empresa["numero_parcela"] is None
    assert empresa["data_vencimento"] == "2026-04-30"
    assert empresa["situacao_divida_ativa"] == "Administrativa"
    assert empresa["situacao_parcelamento"] == "Não parcelado"
    assert empresa["entidade"]["tipo_pessoa"] == "Empresa"
    assert empresa["entidade"]["situacao_registro"] == "ATIVO"
    assert empresa["entidade"]["cpf_cnpj"] == "10.852.801/0001-39"

    profissional = next(d for d in debitos if d["valor_total"] == 542.73)
    assert profissional["situacao_pagamento"] == "Pago a menor"
    assert profissional["situacao_divida_ativa"] == "Executiva"
    assert profissional["situacao_parcelamento"] == "Renegociado"
    assert profissional["entidade"]["tipo_pessoa"] == "Profissional"
    assert profissional["entidade"]["situacao_registro"] == "BAIXADO"
```

- [ ] **Step 3: Rodar o teste e confirmar que falha**

Run:
```bash
docker compose -f docker-compose.yml -f docker-compose.test.yml run --rm \
  -e DATABASE_URL=postgresql+psycopg2://inadimplencia_test:inadimplencia_test@db-test:5432/inadimplencia_test \
  -e RAW_UPLOADS_DIR=/tmp/raw_uploads_teste \
  backend pytest tests/test_upload_xlsx.py -v
```
Expected: FAIL — `ModuleNotFoundError: No module named 'openpyxl'` (ainda não instalado) ou 404 na rota `/uploads/xlsx`.

- [ ] **Step 4: Adicionar `openpyxl` ao `requirements.txt`**

`backend/requirements.txt`:
```
fastapi==0.115.0
uvicorn[standard]==0.30.6
pytest==8.3.3
httpx==0.27.2
sqlalchemy==2.0.35
psycopg2-binary==2.9.9
python-multipart==0.0.12
openpyxl==3.1.5
```

- [ ] **Step 5: Criar o parser de XLSX**

`backend/app/parsers/xlsx_parser.py`:
```python
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from io import BytesIO

from openpyxl import load_workbook

MAX_BLOCOS_DEBITO = 37
_EPOCH_EXCEL = date(1899, 12, 30)


@dataclass
class RegistroDebitoXlsx:
    ano_referencia: int
    tipo_debito: str | None
    data_vencimento: date | None
    valor_original: float | None
    valor_devido: float | None
    valor_total: float | None
    situacao_pagamento: str | None
    situacao_divida_ativa: str | None
    situacao_parcelamento: str | None


@dataclass
class RegistroXlsx:
    nome_original: str
    cpf_cnpj: str | None
    tipo_pessoa: str | None
    categoria: str | None
    subregiao: str | None
    situacao_registro: str | None
    debitos: list[RegistroDebitoXlsx] = field(default_factory=list)


def _texto(valor) -> str | None:
    if valor in (None, ""):
        return None
    return str(valor).strip()


def _numero(valor) -> float | None:
    if valor in (None, ""):
        return None
    return float(valor)


def _data(valor) -> date | None:
    if valor in (None, ""):
        return None
    if isinstance(valor, datetime):
        return valor.date()
    if isinstance(valor, date):
        return valor
    # A célula normalmente já vem com formatação de data aplicada, e o openpyxl devolve
    # datetime nesse caso. Este branch é a rede de segurança para um número serial "cru"
    # (contagem de dias desde 1899-12-30, convenção do Excel), caso um export futuro do
    # CREFITO11 venha sem essa formatação.
    return _EPOCH_EXCEL + timedelta(days=int(float(valor)))


def parse_xlsx(conteudo: bytes) -> list[RegistroXlsx]:
    planilha = load_workbook(BytesIO(conteudo), read_only=True, data_only=True)
    aba = planilha["Dados"]
    linhas = aba.iter_rows(values_only=True)
    cabecalho = next(linhas)
    indice = {nome: i for i, nome in enumerate(cabecalho) if nome}

    registros = []
    for linha in linhas:
        if not linha or not linha[indice["NomeRazaoSocial"]]:
            continue

        registro = RegistroXlsx(
            nome_original=str(linha[indice["NomeRazaoSocial"]]).strip(),
            cpf_cnpj=_texto(linha[indice["CPFCNPJ"]]) if "CPFCNPJ" in indice else None,
            tipo_pessoa=_texto(linha[indice["TipoPessoa"]]) if "TipoPessoa" in indice else None,
            categoria=_texto(linha[indice["Categoria"]]) if "Categoria" in indice else None,
            subregiao=_texto(linha[indice["SubRegiao"]]) if "SubRegiao" in indice else None,
            situacao_registro=_texto(linha[indice["SituacaoRegistro"]]) if "SituacaoRegistro" in indice else None,
        )

        for n in range(MAX_BLOCOS_DEBITO):
            campo_ano = f"Debitos.{n}.AnoReferencia"
            if campo_ano not in indice:
                break
            ano = linha[indice[campo_ano]]
            if not ano:
                continue
            registro.debitos.append(
                RegistroDebitoXlsx(
                    ano_referencia=int(ano),
                    tipo_debito=_texto(linha[indice[f"Debitos.{n}.DebitoTipo"]]),
                    data_vencimento=_data(linha[indice[f"Debitos.{n}.DataVencimento"]]),
                    valor_original=_numero(linha[indice[f"Debitos.{n}.ValorOriginal"]]),
                    valor_devido=_numero(linha[indice[f"Debitos.{n}.ValorDevido"]]),
                    valor_total=_numero(linha[indice[f"Debitos.{n}.ValorTotal"]]),
                    situacao_pagamento=_texto(linha[indice[f"Debitos.{n}.DebitoSituacaoPagamentoNome"]]),
                    situacao_divida_ativa=_texto(linha[indice[f"Debitos.{n}.DebitoSituacaoDividaAtivaNome"]]),
                    situacao_parcelamento=_texto(linha[indice[f"Debitos.{n}.DebitoSituacaoParcelamentoNome"]]),
                )
            )

        registros.append(registro)

    return registros
```

- [ ] **Step 6: Adicionar `ingerir_xlsx` ao serviço de ingestão**

Adicionar ao final de `backend/app/services/ingestion.py` (mantendo tudo que já existe da Task 2):
```python
from app.parsers.xlsx_parser import parse_xlsx


def ingerir_xlsx(sessao: Session, nome_arquivo: str, conteudo: bytes) -> Snapshot:
    snapshot = _criar_snapshot(sessao, "xlsx", nome_arquivo, conteudo)

    cache_entidades: dict[str, Entidade] = {}
    for registro in parse_xlsx(conteudo):
        entidade = _buscar_ou_criar_entidade(
            sessao,
            cache_entidades,
            registro.nome_original,
            extras={
                "cpf_cnpj": registro.cpf_cnpj,
                "tipo_pessoa": registro.tipo_pessoa,
                "categoria": registro.categoria,
                "subregiao": registro.subregiao,
                "situacao_registro": registro.situacao_registro,
            },
        )
        for debito in registro.debitos:
            sessao.add(
                Debito(
                    snapshot_id=snapshot.id,
                    entidade_id=entidade.id,
                    origem="xlsx",
                    ano_referencia=debito.ano_referencia,
                    tipo_debito=debito.tipo_debito,
                    data_vencimento=debito.data_vencimento,
                    valor_original=debito.valor_original,
                    valor_devido=debito.valor_devido,
                    valor_total=debito.valor_total,
                    situacao_pagamento=debito.situacao_pagamento,
                    situacao_divida_ativa=debito.situacao_divida_ativa,
                    situacao_parcelamento=debito.situacao_parcelamento,
                )
            )

    sessao.commit()
    sessao.refresh(snapshot)
    return snapshot
```
(O `import` de `parse_xlsx` vai junto dos outros imports no topo do arquivo, não literalmente no meio do arquivo — ajuste a posição ao editar.)

- [ ] **Step 7: Adicionar a rota de upload de XLSX**

Adicionar a `backend/app/routers/uploads.py` (mantendo o endpoint de CSV já existente):
```python
from app.services.ingestion import ingerir_csv, ingerir_xlsx


@roteador.post("/xlsx", response_model=SnapshotOut, status_code=201)
async def upload_xlsx(arquivo: UploadFile = File(...), sessao: Session = Depends(get_sessao)):
    conteudo = await arquivo.read()
    return ingerir_xlsx(sessao, arquivo.filename, conteudo)
```
(Ajustar o import no topo do arquivo para trazer `ingerir_xlsx` junto de `ingerir_csv`, em vez de duas linhas de import separadas.)

- [ ] **Step 8: Rodar todos os testes e confirmar que passam**

Run:
```bash
docker compose build backend
docker compose -f docker-compose.yml -f docker-compose.test.yml run --rm \
  -e DATABASE_URL=postgresql+psycopg2://inadimplencia_test:inadimplencia_test@db-test:5432/inadimplencia_test \
  -e RAW_UPLOADS_DIR=/tmp/raw_uploads_teste \
  backend pytest -v
```
Expected: PASS — todos os testes (`test_health_retorna_ok`, `test_upload_csv_cria_snapshot_normaliza_nomes_e_persiste_debitos`, `test_upload_xlsx_despivota_debitos_e_persiste_dados_cadastrais`).

- [ ] **Step 9: Verificação manual com os arquivos reais**

Run: `docker compose up -d`
Run:
```bash
curl -F "arquivo=@Relatorio de inadimplencia - Analitico.csv" http://localhost:8000/uploads/csv
curl -F "arquivo=@Relatorio_Inadimplentes_Debitos_20260915_205007.xlsx" http://localhost:8000/uploads/xlsx
curl http://localhost:8000/snapshots
```
Expected: dois snapshots criados (um `csv`, um `xlsx`, este com `data_snapshot` = `2026-09-15T20:50:07`), sem erros 500. Pode levar alguns segundos por causa do volume real de linhas (~41 mil no CSV, ~5 mil linhas x até 37 blocos no XLSX).
Run: `docker compose down`

- [ ] **Step 10: Commit**

```bash
git add backend
git commit -m "feat: ingestao de XLSX com despivot dos blocos de debito"
```

---

## Self-Review

**Cobertura do spec:** Este plano cobre as user stories 1, 2, 3, 4, 5, 6, 7, 8 do spec (upload CSV/XLSX independentes, data de snapshot automática ou por upload, histórico como snapshot, persistência do arquivo bruto, todos os tipos de pessoa, normalização de nome). As stories 9–26 (comparação, rankings, indicadores, dashboard, busca, exportação, mascaramento) ficam para os Planos 2 e 3, conforme já declarado na seção "Escopo deste plano".

**Placeholders:** Nenhum "TBD"/"implementar depois" restante. Uma versão anterior deste plano tinha um placeholder inválido no branch de rede de segurança de `_data()` (`xlsx_parser.py`, Step 5 da Task 3); foi corrigido para a conversão serial-Excel real (`_EPOCH_EXCEL + timedelta(days=...)`), já refletida no código do Step 5 e no import de `timedelta`.

**Consistência de tipos:** `SnapshotOut`, `EntidadeResumoOut` e `DebitoOut` são criados uma única vez na Task 2 e reaproveitados sem alteração na Task 3 — os campos nullable de `EntidadeResumoOut` (`cpf_cnpj`, `tipo_pessoa`, `categoria`, `subregiao`, `situacao_registro`) já preveem tanto entidades vindas só do CSV (todos `None`) quanto do XLSX (preenchidos). `_buscar_ou_criar_entidade`, `_criar_snapshot`, `normalize_nome` e `extrair_data_snapshot` são definidos uma vez na Task 2 e consumidos sem reassinatura na Task 3.

---

**Plano completo e salvo em `docs/superpowers/plans/2026-09-15-crefito11-plano1-infra-ingestao.md`. Duas opções de execução:**

**1. Subagent-Driven (recomendado)** — eu disparo um subagente novo por task, com revisão entre elas, iteração rápida.

**2. Execução Inline** — executo as tasks nesta sessão usando executing-plans, em lote, com checkpoints para revisão.

**Qual abordagem prefere?**
