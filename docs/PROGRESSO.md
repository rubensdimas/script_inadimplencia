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
- Alembic com baseline do schema legado e migracao para o modelo historico.
- CLI `python -m app.cli reprocessar-snapshots` para reconstruir dados derivados a partir dos arquivos brutos.
- Protecao dos testes contra uso acidental do banco principal.

Commits principais:

- `418e794` - plano de conclusao do sistema.
- `6dea3f6` - modelo historico, ingestao robusta e migracoes.

### Verificacoes registradas

- Backend: `python -m pytest tests -v` resultou em `11 passed`, sem warnings, no commit `6dea3f6`.
- Python: `python -m compileall -q app alembic tests` concluiu com sucesso.
- Alembic: `alembic current` indicou `0002_historical_observations (head)`.
- Alembic: `alembic check` informou `No new upgrade operations detected`.
- Frontend placeholder: `npm run build` concluiu com sucesso antes da implementacao das telas finais.
- Validacao exploratoria local, sem versionar dados reais:
  - 41.612 debitos no CSV;
  - 22.543 debitos no XLSX;
  - 39 grupos de nomes normalizados associados a documentos distintos;
  - 28 desses grupos tambem aparecem no CSV.

## Review pendente da Tarefa 1

O commit `6dea3f6` foi revisado e ainda nao deve ser considerado pronto para merge. Os seguintes pontos precisam ser corrigidos antes de iniciar a camada analitica:

1. Converter valores monetarios do parser XLSX para `Decimal` desde a leitura, evitando passagem intermediaria por `float`.
2. Eliminar a janela em que uma falha posterior ao `commit` pode remover o arquivo bruto de um snapshot ja persistido.
3. Validar o reprocessamento consultando as linhas efetivamente persistidas, em vez de comparar duas contagens derivadas da mesma lista em memoria.
4. Testar a adocao Alembic contra um banco legado real, com tabelas e dados existentes mas sem `alembic_version`.
5. Rejeitar registros XLSX sem CPF/CNPJ, pois a identidade canonica dessa fonte depende do documento.

Uma primeira correcao para `Decimal` e documento em branco foi iniciada e preservada localmente no stash `wip: correcoes do review da tarefa 1`. Ela ainda precisa ser retomada, completada, testada e revisada.

## Proximas etapas

1. Concluir a rodada de correcoes da Tarefa 1 e repetir o review.
2. Implementar pareamento contextual CSV/XLSX, comparacoes e dashboard analitico.
3. Implementar busca de entidades, historico e exportacoes CSV/XLSX.
4. Construir o frontend operacional: uploads, dashboard, entidades e pendencias.
5. Adicionar testes de componentes e jornada Playwright ponta a ponta.

O plano detalhado esta em [`docs/superpowers/plans/2026-09-15-crefito11-conclusao-sistema.md`](superpowers/plans/2026-09-15-crefito11-conclusao-sistema.md).

## Seguranca

- Os relatorios reais permanecem ignorados pelo Git.
- Arquivos `.env`, volumes Docker e o workspace local de agentes nao sao versionados.
- O projeto e destinado a uso local e nao deve ser exposto diretamente na internet.

