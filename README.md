# Analise de Inadimplencia CREFITO11

Aplicacao local para importar os relatorios CSV e XLSX de inadimplencia, preservar snapshots historicos e consultar os dados pela API e pela interface web.

## Requisitos

- Docker Engine
- Docker Compose v2 (`docker compose`)

Nao e necessario instalar Python, Node.js ou PostgreSQL na maquina.

## Iniciar o projeto

1. Crie o arquivo de configuracao local:

   ```bash
   cp .env.example .env
   ```

2. Construa as imagens e inicie os servicos:

   ```bash
   docker compose up --build -d
   ```

3. Confira o estado dos containers:

   ```bash
   docker compose ps
   ```

O backend aguarda o PostgreSQL ficar saudavel e executa automaticamente `alembic upgrade head` antes de iniciar.

## Enderecos locais

- Interface web: http://localhost:5173
- API: http://localhost:8000
- Documentacao Swagger: http://localhost:8000/docs
- Health check: http://localhost:8000/health
- PostgreSQL: `localhost:5432`

Teste rapido do backend:

```bash
curl http://localhost:8000/health
```

Resposta esperada:

```json
{"status":"ok"}
```

## Importar relatorios

Os dois formatos sao importados de forma independente. Os arquivos enviados sao preservados no volume Docker `raw_uploads`.

### CSV analitico

```bash
curl -X POST http://localhost:8000/api/uploads/csv \
  -F "arquivo=@Relatorio de inadimplencia - Analitico.csv"
```

### XLSX de debitos

```bash
curl -X POST http://localhost:8000/api/uploads/xlsx \
  -F "arquivo=@Relatorio_Inadimplentes_Debitos_20260915_205007.xlsx"
```

Os nomes acima sao exemplos. Substitua o caminho depois de `@` pelo arquivo que deseja importar.

Listar snapshots importados:

```bash
curl http://localhost:8000/api/snapshots
```

Filtrar por origem:

```bash
curl "http://localhost:8000/api/snapshots?tipo_arquivo=xlsx"
```

## Consultar analises, busca e exportacoes

Todos os endpoints abaixo aceitam `csv_snapshot_id`/`xlsx_snapshot_id` opcionais (quando omitidos, usam o snapshot mais recente de cada tipo). A documentacao interativa completa (schemas de request/response) esta em http://localhost:8000/docs.

Dashboard analitico (indicadores, rankings, divida ativa, distribuicoes, serie historica; os rankings e a divida ativa na resposta JSON sao limitados ao top-50 -- use a exportacao para o conjunto completo):

```bash
curl "http://localhost:8000/api/dashboard?csv_snapshot_id=1&xlsx_snapshot_id=2"
```

Comparacao completa entre um snapshot CSV e um snapshot XLSX (entidades exclusivas, obrigacoes exclusivas por entidade pareada, conflitos de parcelamento, nomes ambiguos):

```bash
curl "http://localhost:8000/api/comparisons?csv_snapshot_id=1&xlsx_snapshot_id=2"
```

Busca de entidades (aceita `query`, `tipo_pessoa`, `situacao_registro`, `page`, `page_size`):

```bash
curl "http://localhost:8000/api/entities?query=maria"
```

Detalhe de uma entidade (historico de observacoes/debitos por snapshot):

```bash
curl "http://localhost:8000/api/entities/1"
```

Pendencias de pareamento (nomes que nao bateram automaticamente entre CSV e XLSX no par de snapshots selecionado):

```bash
curl "http://localhost:8000/api/matching-issues?csv_snapshot_id=1&xlsx_snapshot_id=2"
```

Exportacao CSV/XLSX de um dataset (`ranking`, `comparisons`, `entities` ou `matching-issues`; `format=csv` ou `format=xlsx`, `csv` e o padrao). Diferente da resposta JSON do dashboard, a exportacao de `ranking` sempre traz o conjunto completo, sem teto:

```bash
curl -OJ "http://localhost:8000/api/exports/ranking?csv_snapshot_id=1&xlsx_snapshot_id=2&format=xlsx"
```

## Comandos operacionais

Ver logs de todos os servicos:

```bash
docker compose logs -f
```

Ver apenas os logs do backend:

```bash
docker compose logs -f backend
```

Reiniciar um servico:

```bash
docker compose restart backend
```

Parar os containers preservando banco e uploads:

```bash
docker compose down
```

### Reprocessar snapshots

O comando abaixo rele os arquivos brutos ja associados aos snapshots e recria seus dados derivados:

```bash
docker compose exec backend python -m app.cli reprocessar-snapshots
```

Use-o somente quando os arquivos originais ainda estiverem disponiveis no volume `raw_uploads`.

### Conferir migracoes

```bash
docker compose exec backend alembic current
docker compose exec backend alembic check
```

## Executar os testes

Suba o PostgreSQL efemero de testes:

```bash
docker compose -f docker-compose.yml -f docker-compose.test.yml up -d db-test
```

Execute a suite do backend contra o banco `_test`:

```bash
docker compose -f docker-compose.yml -f docker-compose.test.yml run --rm \
  -e DATABASE_URL=postgresql+psycopg2://inadimplencia_test:inadimplencia_test@db-test:5432/inadimplencia_test \
  -e RAW_UPLOADS_DIR=/tmp/raw_uploads_teste \
  backend python -m pytest tests -v
```

Execute o build do frontend:

```bash
docker compose run --rm --no-deps frontend npm run build
```

Ao terminar, pare o banco de testes:

```bash
docker compose -f docker-compose.yml -f docker-compose.test.yml stop db-test
```

### Suite de testes do frontend (Vitest)

A partir de `frontend/`, com Node.js instalado no host (o container Docker do frontend so roda `npm run dev`; para testes/build fora do host, use `docker compose run --rm --no-deps frontend npm test -- --run` e `docker compose run --rm --no-deps frontend npm run build`):

```bash
cd frontend
npm install
npm test
npm run build
```

### Suite E2E (Playwright)

A jornada ponta a ponta (`frontend/e2e/journey.spec.ts`) roda contra o stack real via Docker Compose, em `desktop-chromium` e `mobile-chromium`. Ambientes sem `sudo` sem senha nao conseguem rodar `npx playwright install --with-deps`; a alternativa comprovada neste repositorio e usar a imagem oficial `mcr.microsoft.com/playwright`, que ja traz o navegador e as dependencias de sistema:

```bash
# 1. Suba o stack completo e aguarde o backend responder.
docker compose up -d --build
until curl -sf http://localhost:8000/health > /dev/null; do sleep 1; done

# 2. Instale as dependencias do frontend (fora do container, no host).
cd frontend
npm install

# 3. Rode a suite Playwright dentro da imagem oficial, contra o stack ja no ar.
docker run --rm --network host \
  -e E2E_BASE_URL=http://localhost:5173 \
  -e HOME=/tmp \
  -v "$(pwd)":/work -w /work \
  mcr.microsoft.com/playwright:v1.63.0-noble \
  npx playwright test

# 4. Ao terminar, derrube o stack.
cd ..
docker compose down
```

Se o ambiente permitir instalar as dependencias de sistema do Playwright localmente, a alternativa mais simples e `npx playwright install --with-deps chromium && npx playwright test` (a partir de `frontend/`, com o stack no ar).

## Configuracao

As variaveis disponiveis em `.env` sao:

| Variavel | Padrao | Descricao |
| --- | --- | --- |
| `POSTGRES_USER` | `inadimplencia` | Usuario do PostgreSQL |
| `POSTGRES_PASSWORD` | `inadimplencia` | Senha do PostgreSQL |
| `POSTGRES_DB` | `inadimplencia` | Nome do banco principal |

O banco e os arquivos enviados ficam em volumes Docker e sobrevivem a `docker compose down`.

## Reset completo

O comando a seguir remove containers, banco, snapshots e arquivos enviados. Esta operacao nao pode ser desfeita:

```bash
docker compose down -v
```

Depois do reset, execute novamente `docker compose up --build -d`.

## Seguranca dos dados

- Os relatorios reais contem CPF/CNPJ e informacoes financeiras; nao os adicione ao Git.
- A API e a interface mascaram CPF/CNPJ, mas o valor integral permanece no banco local para o pareamento.
- O projeto foi projetado para uso local e nao deve ser exposto diretamente na internet.

