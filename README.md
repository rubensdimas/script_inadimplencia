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

Excluir um snapshot (tambem remove observacoes, debitos, o arquivo bruto e qualquer entidade que fique sem nenhuma observacao remanescente; nao pode ser desfeito):

```bash
curl -X DELETE http://localhost:8000/api/snapshots/1
```

Na interface web, o mesmo pode ser feito clicando no icone de lixeira ao lado de cada item em "Ultimos envios" (aba Uploads).

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

Execute os testes do frontend:

```bash
docker compose run --rm --no-deps frontend npm run test
```

Execute o build do frontend:

```bash
docker compose run --rm --no-deps frontend npm run build
```

Ao terminar, pare o banco de testes:

```bash
docker compose -f docker-compose.yml -f docker-compose.test.yml stop db-test
```

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

