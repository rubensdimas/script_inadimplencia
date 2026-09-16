# CREFITO11 - Conclusao do Sistema Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir a identidade historica da ingestao e entregar a API analitica, exportacoes e frontend operacional do sistema de inadimplencia.

**Architecture:** PostgreSQL guarda entidades canonicas por CPF/CNPJ, observacoes imutaveis por snapshot e debitos ligados a essas observacoes. O pareamento CSV/XLSX e calculado para o par de snapshots escolhido, sem fuzzy matching. FastAPI expoe recursos paginados e exportacoes; React consome a API por `/api`.

**Tech Stack:** PostgreSQL 16, Python 3.12, FastAPI, SQLAlchemy 2, Alembic, openpyxl, pytest/httpx, React 18, TypeScript, Vite, TanStack Query, React Router, Recharts, Lucide, Vitest, Testing Library e Playwright.

**Spec:** `docs/specs/001-analise-inadimplencia-crefito11.md`

## Global Constraints

- Sistema local, mono-usuario, sem autenticacao e sem fuzzy matching.
- CPF/CNPJ normalizado em digitos identifica a entidade XLSX; nunca expor documento integral em API, tela ou exportacao.
- Dados cadastrais sao observacoes imutaveis do snapshot, incluindo `RegistroResumido`.
- CSV permanece sem vinculo canonico permanente; o pareamento usa nomes normalizados dentro do par de snapshots selecionado.
- Obrigacao distinta usa `ano_referencia + tipo_debito normalizado`; parcelas CSV continuam linhas separadas.
- `ValorTotal` e a metrica financeira principal; valores monetarios usam `Decimal` no backend.
- Parcelamento CSV `Parcelamento` corresponde a XLSX `Renegociado` ou `Exercicio corrente`; valores nao sao comparados entre fontes.
- Documentos reais permanecem fora do Git. Validacao automatizada usa fixtures sinteticas.
- Toda mudanca comportamental segue RED, GREEN e refactor; testes backend sao executados com `python -m pytest`.

---

### Task 1: Modelo historico, Alembic e ingestao robusta

**Files:**
- Modify: `backend/requirements.txt`, `backend/app/models.py`, `backend/app/schemas.py`, `backend/app/services/ingestion.py`, parsers e routers existentes
- Create: `backend/alembic.ini`, `backend/alembic/`, `backend/app/documentos.py`, `backend/app/errors.py`, `backend/app/cli.py`
- Modify/Create tests under `backend/tests/`

**Interfaces:**
- Produces `Entidade(documento_normalizado unique, tipo_pessoa)`, `ObservacaoEntidade(snapshot_id, entidade_id nullable, nome_original, nome_normalizado, registro_resumido, dados cadastrais)` e `Debito(observacao_id, ...)`.
- `POST /api/uploads/csv` e `POST /api/uploads/xlsx` retornam `SnapshotOut`; rotas legadas sem `/api` deixam de ser publicas.
- `GET /api/snapshots` aceita `tipo_arquivo`; `GET /api/snapshots/{id}/debitos` e paginado e retorna documento mascarado.
- Entradas invalidas retornam `422`; snapshot ausente retorna `404`.
- `python -m app.cli reprocessar-snapshots` reprocessa caminhos brutos preservando metadados de snapshot e valida contagens antes de substituir dados derivados.

- [ ] Escrever testes de integracao falhando para homonimos com documentos distintos, aliases do mesmo documento, atributos historicos, mascara, erros `422`, `404`, paginacao e limpeza de staging.
- [ ] Implementar o schema e a ingestao minima para passar os testes.
- [ ] Adicionar Alembic com baseline e revisao do novo modelo; remover `create_all()` do startup e executar `alembic upgrade head` no fluxo Docker.
- [ ] Implementar reprocessamento idempotente dos snapshots existentes a partir dos arquivos brutos.
- [ ] Corrigir ambiente de testes para nao depender do banco principal e eliminar warnings da suite.
- [ ] Executar suite backend completa e commit.

---

### Task 2: Pareamento, comparacao e dashboard analitico

**Files:**
- Create: `backend/app/services/matching.py`, `backend/app/services/analytics.py`, `backend/app/routers/analytics.py`
- Modify: `backend/app/schemas.py`, `backend/app/main.py`
- Create tests: `backend/tests/test_comparisons.py`, `backend/tests/test_dashboard.py`

**Interfaces:**
- `GET /api/comparisons?csv_snapshot_id=&xlsx_snapshot_id=` retorna resumo, entidades exclusivas, obrigacoes exclusivas, conflitos de parcelamento e nomes ambiguos.
- Candidatos CSV: zero = somente CSV, um documento distinto = confirmado, mais de um = ambiguo sem associacao.
- `GET /api/dashboard?csv_snapshot_id=&xlsx_snapshot_id=` retorna indicadores, ranking por obrigacoes distintas, ranking por soma de `valor_total`, divida ativa, distribuicoes por ano/tipo/situacao e serie historica XLSX.
- IDs omitidos usam o snapshot mais recente de cada tipo; IDs do tipo errado retornam `422`.

- [ ] Escrever fixtures e testes falhando para todos os estados de pareamento e metricas definidas.
- [ ] Implementar matching puro sobre os snapshots escolhidos.
- [ ] Implementar consultas analiticas e schemas de resposta.
- [ ] Verificar contagens, ordenacao deterministica, `Decimal` e mascaramento.
- [ ] Executar suite backend completa e commit.

---

### Task 3: Busca, historico e exportacoes

**Files:**
- Create: `backend/app/services/entities.py`, `backend/app/services/exports.py`, `backend/app/routers/entities.py`, `backend/app/routers/exports.py`
- Modify: `backend/app/schemas.py`, `backend/app/main.py`, `backend/requirements.txt`
- Create tests: `backend/tests/test_entities.py`, `backend/tests/test_exports.py`

**Interfaces:**
- `GET /api/entities` suporta `query`, `tipo_pessoa`, `situacao_registro`, `page` e `page_size`.
- `GET /api/entities/{id}` retorna dados mascarados, observacoes por snapshot e debitos historicos.
- `GET /api/matching-issues` retorna pendencias para o par selecionado.
- `GET /api/exports/{dataset}?format=csv|xlsx` exporta `ranking`, `comparisons`, `entities` ou `matching-issues` usando os mesmos filtros dos endpoints JSON.

- [ ] Escrever testes falhando de busca normalizada, filtros, historico, paginacao e quatro datasets exportaveis.
- [ ] Implementar servicos compartilhados entre JSON e exportacao.
- [ ] Garantir cabecalhos, nomes de arquivo, tipos monetarios e documentos mascarados em CSV/XLSX.
- [ ] Executar suite backend completa e commit.

---

### Task 4: Shell frontend, uploads e dashboard

**Files:**
- Modify: `frontend/package.json`, `frontend/vite.config.ts`, `frontend/src/App.tsx`, `frontend/src/main.tsx`
- Create focused files under `frontend/src/api/`, `frontend/src/components/`, `frontend/src/pages/`, `frontend/src/styles/`
- Create Vitest/Testing Library tests beside features

**Interfaces:**
- Vite encaminha `/api` para `http://backend:8000` e o cliente tipado trata loading, erro e respostas paginadas.
- Navegacao: Dashboard, Uploads, Entidades e Pendencias.
- Dashboard possui seletores CSV/XLSX, indicadores, rankings, divida ativa, distribuicoes e evolucao.
- Uploads envia cada fonte independentemente e exibe sucesso ou erro acionavel.

- [ ] Escrever testes de componentes falhando para navegacao, seletores, estados e upload.
- [ ] Implementar shell operacional responsivo e cliente HTTP.
- [ ] Implementar Uploads e Dashboard com TanStack Query, Recharts e Lucide.
- [ ] Garantir layout sem sobreposicao em larguras moveis e desktop.
- [ ] Executar testes e build frontend completos e commit.

---

### Task 5: Entidades, pendencias, exportacao e jornada ponta a ponta

**Files:**
- Create/Modify pages and components under `frontend/src/`
- Create: `frontend/playwright.config.ts`, `frontend/e2e/`
- Modify: `docker-compose.yml`, project documentation as needed

**Interfaces:**
- Tela Entidades oferece busca, filtros, paginacao e detalhe historico.
- Tela Pendencias separa nomes ambiguos e ausentes e respeita os snapshots escolhidos.
- Acoes de exportacao preservam filtros e baixam o formato escolhido.
- Playwright cobre upload, troca de snapshots, dashboard, busca, pendencias e exportacao.

- [ ] Escrever testes falhando para tabelas, detalhe, pendencias e downloads.
- [ ] Implementar as telas e integrar exportacoes.
- [ ] Adicionar Playwright com fixtures sinteticas e jornada completa.
- [ ] Validar Docker Compose, backend, frontend e viewports desktop/mobile.
- [ ] Executar verificacao completa, documentar comandos operacionais e commit.

