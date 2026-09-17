# Progresso do Projeto

Atualizado em 17/09/2026 no branch `feat/analise-inadimplencia-completa`.

## Objetivo

Construir uma aplicacao local para importar os relatorios CSV e XLSX de inadimplencia do CREFITO11, preservar snapshots historicos, comparar as fontes e disponibilizar indicadores, busca e exportacoes em uma interface web.

## Estado atual

### Concluido

- Estrutura Docker Compose com PostgreSQL, FastAPI e React/Vite.
- Upload e parsing dos formatos CSV e XLSX.
- Preservacao dos arquivos brutos em volume Docker.
- Modelo historico com:
  - entidades canonicas identificadas por CPF/CNPJ normalizado;
  - observacoes cadastrais imutaveis por snapshot;
  - `RegistroResumido` preservado por observacao;
  - debitos associados a observacao do snapshot;
  - registros CSV sem pareamento canonico permanente.
- CPF/CNPJ mascarado nos contratos atuais da API.
- Endpoints sob `/api` para upload, listagem de snapshots e consulta paginada de debitos.
- Respostas `422` para entradas invalidas e `404` para snapshot inexistente.
- Alembic com baseline do schema legado e migracao para o modelo historico, com cobertura de teste contra um banco legado real sem `alembic_version`.
- CLI `python -m app.cli reprocessar-snapshots` para reconstruir dados derivados a partir dos arquivos brutos, isolando falhas por snapshot (uma falha nao aborta o lote inteiro).
- Protecao dos testes contra uso acidental do banco principal.
- Valores monetarios do XLSX como `Decimal` desde a leitura do parser.
- Rejeicao de registros XLSX sem CPF/CNPJ, com contexto de linha e nome no erro; linhas com documento zerado/invalido sao isoladas (reportadas em `linhas_invalidas`) em vez de abortar o snapshot inteiro.
- Pareamento CSV/XLSX por nome normalizado dentro do par de snapshots selecionado (`GET /api/comparisons`), sem fuzzy matching: entidades e obrigacoes exclusivas de cada fonte, conflitos de parcelamento e nomes ambiguos.
- Dashboard analitico (`GET /api/dashboard`): indicadores agregados, rankings por obrigacoes distintas e por valor total, divida ativa, distribuicoes por ano/tipo/situacao de pagamento, situacao cadastral cruzada com debito em aberto, e serie historica entre snapshots XLSX.
- Pendencias de pareamento (`GET /api/matching-issues`) para revisao manual de nomes que nao bateram entre as fontes.
- Busca e historico de entidades (`GET /api/entities`, `GET /api/entities/{id}`) com filtros por nome, tipo de pessoa e situacao cadastral, paginacao e historico completo de observacoes/debitos por snapshot.
- Exportacoes CSV/XLSX (`GET /api/exports/{dataset}`) para os datasets `ranking`, `comparisons`, `entities` e `matching-issues`, com os mesmos filtros dos endpoints JSON.
- Shell frontend operacional: navegacao (Dashboard, Uploads, Entidades, Pendencias), Tailwind + shadcn/ui (Button/Card/Alert proprios), React Router, TanStack Query, e tipos TypeScript gerados do `/openapi.json` real do backend (`openapi-typescript`) por tras de um cliente fetch fino.
- Tela de Uploads completa: envio independente de CSV e XLSX, historico dos ultimos envios por fonte, resumo do snapshot criado e aviso das linhas invalidas ignoradas, erro acionavel vindo da API (tanto o `detail` string do `ErroIngestao` quanto o `detail` lista de validacao do FastAPI).

Commits principais:

- `418e794` - plano de conclusao do sistema.
- `6dea3f6` - modelo historico, ingestao robusta e migracoes.
- `b6b00ba` - correcao dos 5 achados do review da Tarefa 1 (Decimal, janela de exclusao do arquivo bruto, contagem persistida no reprocessamento, documento obrigatorio no XLSX, migracao Alembic contra banco legado real).
- `31f4018` - pareamento CSV/XLSX e API de comparacao/dashboard analitico (Tarefa 2).
- `d127398` - dashboard cruza situacao cadastral com debito em aberto (story 18).
- `2c12174` - uso de `Decimal` (nao float) em todo campo monetario de comparisons/dashboard.
- `b494888` - busca/historico de entidades, pendencias de pareamento e exportacoes CSV/XLSX (Tarefa 3).
- `2fb6d40` - XLSX isola linhas com documento zerado/invalido em vez de abortar o snapshot.
- `1d2f006` - shell frontend, tipos gerados da API e tela de Uploads (Tarefa 4, fatia 1).

### Verificacoes registradas

- Backend: `python -m pytest tests -v` resultou em `71 passed`, sem warnings, apos a Tarefa 3 e o fix de documentos invalidos no XLSX.
- Python: `python -m compileall -q app alembic tests` concluiu com sucesso.
- Alembic: `alembic current` indicou `0002_historical_observations (head)`.
- Alembic: `alembic check` informou `No new upgrade operations detected`.
- Frontend: `npm run test` (Vitest + Testing Library + MSW) resultou em `10 passed`, dentro e fora do Docker.
- Frontend: `npm run build` (`tsc -b && vite build`) concluiu sem erros, dentro e fora do Docker.
- Smoke test manual: stack subida via `docker compose up -d`, proxy `/api` do Vite confirmado ponta a ponta contra o backend real (`GET /api/snapshots` via `http://localhost:5173/api/snapshots`).
- Validacao exploratoria local, sem versionar dados reais:
  - 41.612 debitos no CSV;
  - 22.543 debitos no XLSX;
  - 39 grupos de nomes normalizados associados a documentos distintos;
  - 28 desses grupos tambem aparecem no CSV.

## Tarefa 1: concluida

O commit `6dea3f6` foi revisado, e os 5 achados foram corrigidos e re-testados em `b6b00ba`. Um segundo review sobre o diff `6dea3f6..b6b00ba` encontrou mais um achado importante, ja corrigido na sequencia (nao commitado em separado, faz parte do mesmo ciclo de correcao):

- O `reprocessar-snapshots` em lote nao isolava falha por snapshot: como o parser passou a rejeitar XLSX sem CPF/CNPJ, um snapshot legado com essa lacuna no arquivo bruto abortava o processamento de todos os snapshots seguintes. `reprocessar_todos_snapshots` agora captura a falha por snapshot e devolve um `ResultadoReprocessamento` com sucessos e falhas; a CLI reporta cada falha e sai com codigo 1 se houver alguma, sem interromper o lote.

Achados menores tambem corrigidos no mesmo ciclo: retornos mortos de `_persistir_csv`/`_persistir_xlsx` removidos; consulta de contagem de debitos por snapshot extraida para `contar_debitos_do_snapshot`, compartilhada entre o reprocessamento e a paginacao da API.

**Concern deferido:** `_ingerir` atualiza `sessao.refresh(snapshot)` fora do bloco `try` (intencional, para nao apagar o arquivo bruto de um upload ja commitado se o refresh falhar depois). Se esse refresh falhar, o cliente recebe um 500 sem saber que o snapshot foi persistido, podendo reenviar o upload e criar um snapshot duplicado — nao ha chave de idempotencia no upload hoje. Nao corrigido agora porque a solucao correta (idempotencia no upload) e maior que este ciclo de bug-fix; fica registrado para ser resolvido ou reavaliado na camada de API do Plano 2/3.

## Tarefa 4 (fatia 1 - shell + Uploads): concluida

Entrega fatiada por vertical em vez de shell completo antes de qualquer tela: Uploads primeiro (unica tela que escreve, pre-requisito para as demais terem dados reais), shell e infra compartilhada construidos junto.

Decisoes tecnicas:

- **Tipos**: gerados por `openapi-typescript` a partir do `/openapi.json` real (nao escritos a mao, nao um cliente totalmente gerado) — elimina drift de tipos (ex.: `Decimal` do backend vira `string` no JSON) sem acoplar a um cliente pesado.
- **Estilo**: Tailwind + shadcn/ui, componentes `Button`/`Card`/`Alert` escritos a mao (nao via CLI do shadcn) seguindo a convencao do projeto.
- **Erro da API**: o `detail` de uma resposta nao-2xx pode ser uma string (regra de negocio, `ErroIngestao`) ou uma lista de objetos `{msg, loc, type}` (validacao padrao do FastAPI); `ApiError` em `src/api/client.ts` normaliza os dois formatos numa mensagem exibivel.

**Achado corrigido durante a verificacao:** os testes passavam no host mas falhavam dentro do container Docker do frontend com `TypeError: webidl.util.markAsUncloneable is not a function`. Causa: o setup de teste alinha `fetch`/`File`/`FormData` ao pacote `undici` (o ambiente jsdom instala sua propria implementacao dessas classes, incompativel com o fetch nativo do Node, o que quebrava upload multipart nos testes). A versao mais recente do `undici` (usada tanto pelo projeto quanto internamente pelo jsdom) exige Node >=22.19; a imagem `node:20-slim` do `frontend/Dockerfile` nao atendia esse requisito, embora o host (Node 24) mascarasse o problema. Corrigido subindo a imagem para `node:24-slim` e revalidado com `npm run test`/`npm run build` dentro do container.

## Proximas etapas

1. Tarefa 4 (fatia 2): pagina de Dashboard com seletores de snapshot CSV/XLSX, indicadores, rankings, divida ativa, distribuicoes e evolucao (Recharts).
2. Tarefa 5: telas de Entidades (busca/filtro/paginacao/detalhe historico) e Pendencias de pareamento; acoes de exportacao nas telas relevantes.
3. Tarefa 5: Playwright cobrindo upload, troca de snapshots, dashboard, busca, pendencias e exportacao; validacao de viewports desktop/mobile.

O plano detalhado esta em [`docs/superpowers/plans/2026-09-15-crefito11-conclusao-sistema.md`](superpowers/plans/2026-09-15-crefito11-conclusao-sistema.md).

## Seguranca

- Os relatorios reais permanecem ignorados pelo Git.
- Arquivos `.env`, volumes Docker e o workspace local de agentes nao sao versionados.
- O projeto e destinado a uso local e nao deve ser exposto diretamente na internet.

