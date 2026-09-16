# Progresso do Projeto

Atualizado em 16/09/2026 no branch `feat/analise-inadimplencia-completa`.

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
- Rejeicao de registros XLSX sem CPF/CNPJ, com contexto de linha e nome no erro.

Commits principais:

- `418e794` - plano de conclusao do sistema.
- `6dea3f6` - modelo historico, ingestao robusta e migracoes.
- `b6b00ba` - correcao dos 5 achados do review da Tarefa 1 (Decimal, janela de exclusao do arquivo bruto, contagem persistida no reprocessamento, documento obrigatorio no XLSX, migracao Alembic contra banco legado real).

### Verificacoes registradas

- Backend: `python -m pytest tests -v` resultou em `17 passed`, sem warnings, apos a rodada de correcao da Tarefa 1 e do review seguinte.
- Python: `python -m compileall -q app alembic tests` concluiu com sucesso.
- Alembic: `alembic current` indicou `0002_historical_observations (head)`.
- Alembic: `alembic check` informou `No new upgrade operations detected`.
- Frontend placeholder: `npm run build` concluiu com sucesso antes da implementacao das telas finais.
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

## Proximas etapas

1. Implementar pareamento contextual CSV/XLSX, comparacoes e dashboard analitico (Tarefa 2 do plano).
2. Implementar busca de entidades, historico e exportacoes CSV/XLSX.
3. Construir o frontend operacional: uploads, dashboard, entidades e pendencias.
4. Adicionar testes de componentes e jornada Playwright ponta a ponta.

O plano detalhado esta em [`docs/superpowers/plans/2026-09-15-crefito11-conclusao-sistema.md`](superpowers/plans/2026-09-15-crefito11-conclusao-sistema.md).

## Seguranca

- Os relatorios reais permanecem ignorados pelo Git.
- Arquivos `.env`, volumes Docker e o workspace local de agentes nao sao versionados.
- O projeto e destinado a uso local e nao deve ser exposto diretamente na internet.

