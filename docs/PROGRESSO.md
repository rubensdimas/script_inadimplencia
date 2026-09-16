# Progresso do Projeto

Atualizado em 16/09/2026 no branch `feat/analise-inadimplencia-completa`, apos a rodada de correcao do review final de integracao (as 5 tarefas do plano ja concluidas e revisadas individualmente).

## Objetivo

Construir uma aplicacao local para importar os relatorios CSV e XLSX de inadimplencia do CREFITO11, preservar snapshots historicos, comparar as fontes e disponibilizar indicadores, busca e exportacoes em uma interface web.

## Estado atual

### Concluido -- as 5 tarefas do plano

1. **Modelo de dados e ingestao (Tarefa 1)**: estrutura Docker Compose com PostgreSQL, FastAPI e React/Vite; upload e parsing dos formatos CSV e XLSX (despivot dos blocos de debito no XLSX); preservacao dos arquivos brutos em volume Docker; modelo historico com entidades canonicas identificadas por CPF/CNPJ normalizado, observacoes cadastrais imutaveis por snapshot, `RegistroResumido` preservado por observacao, debitos associados a observacao do snapshot; CPF/CNPJ mascarado nos contratos da API; Alembic com baseline do schema legado; CLI `python -m app.cli reprocessar-snapshots` isolando falhas por snapshot.
2. **Pareamento, comparacoes e dashboard analitico (Tarefa 2)**: pareamento puro por nome normalizado dentro de um par de snapshots (`/api/comparisons`), deteccao de nomes ambiguos e obrigacoes/conflitos de parcelamento exclusivos de uma fonte, indicadores e distribuicoes analiticas (`/api/dashboard`), cruzamento de situacao cadastral com debito em aberto (spec story 18), serie historica XLSX.
3. **Busca de entidades e exportacoes (Tarefa 3)**: busca/paginacao/historico de entidades (`/api/entities`, `/api/entities/{id}`), pendencias de pareamento agrupadas para revisao manual (`/api/matching-issues`), exportacoes CSV/XLSX para os quatro datasets (`ranking`, `comparisons`, `entities`, `matching-issues`) via `/api/exports/{dataset}`.
4. **Frontend operacional -- Uploads e Dashboard (Tarefa 4)**: shell React com navegacao, telas de Uploads (com feedback de sucesso/erro por cartao) e Dashboard (indicadores, rankings, tabela de divida ativa, 4 graficos Recharts, evolucao historica), consumindo a API via TanStack Query.
5. **Frontend operacional -- Entidades, Pendencias e E2E (Tarefa 5)**: telas de Entidades (busca/filtros/paginacao/detalhe historico) e Pendencias (somente-CSV, somente-XLSX, nomes ambiguos), botoes de exportacao em cada tela preservando o snapshot selecionado, jornada Playwright ponta a ponta (upload -> dashboard -> entidades -> pendencias -> exportacoes) contra o stack Docker real, em desktop e mobile.

Commits principais: `418e794` (plano), `6dea3f6`+`b6b00ba`+`d8db96d` (Tarefa 1, feat + correcoes de review), `31f4018`+`d127398`+`2c12174` (Tarefa 2, feat + correcoes de review), `b494888` (Tarefa 3), `b559c1f` (Tarefa 4), `3568a30` (Tarefa 5).

### Correcao pos-review final de integracao

Apos a Tarefa 5, um review final sobre o branch inteiro (nao apenas o diff da ultima tarefa) encontrou 6 achados, todos corrigidos numa rodada de fix-wave dedicada:

1. N+1 de query em `matching.py` (`_observacoes_snapshot` sem eager-load de `.debitos`) que se tornou visivel ao usuario porque a Tarefa 5 adicionou o botao "Exportar comparacao completa" na tela de Pendencias, que passa a exercitar `montar_comparacao` em producao (~4.160 nomes pareados, ~8.300 lazy loads por chamada). Corrigido com `joinedload` compartilhado entre `matching.py` e `analytics.py`.
2. `montar_dashboard` retornava rankings e divida ativa sem limite (potencialmente ~5.331 entidades / 11k+ linhas em uma unica resposta JSON). A resposta JSON de `/api/dashboard` agora tem teto de top-50 (ordenacao preservada); a exportacao (`gerar_exportacao_ranking`) continua sem teto via `montar_dashboard(..., limite=None)`.
3. O botao de exportacao de ranking do Dashboard usava o estado bruto do seletor de snapshot (`undefined` quando "Mais recente" esta selecionado) em vez do snapshot que o backend efetivamente resolveu e devolveu em `indicadores`. Corrigido para usar `dashboard.data.indicadores.csv_snapshot_id`/`xlsx_snapshot_id`, igual ao padrao ja usado em `PendenciasPage`.
4. `UploadCard` nao limpava o campo de arquivo apos um upload bem-sucedido (o nome do arquivo anterior continuava visivel). Corrigido: o input e o estado local sao resetados no `onSuccess` da mutacao.
5. Imagem base do Docker do frontend (`node:20-slim`) desatualizada em relacao ao minimo exigido por devDependencies adicionadas na Tarefa 4 (`EBADENGINE`). Atualizada para `node:22-slim`; build e testes verificados dentro do container reconstruido (ver `.superpowers/sdd/2026-09-15-crefito11-conclusao-sistema/final-fix-report.md`).
6. Esta pagina e o `README.md` estavam desatualizados (ainda listavam as Tarefas 2-5 como pendentes). Atualizados para refletir o estado real do branch.

### Verificacoes registradas

- Backend: `python -m pytest tests -v` (via `docker compose ... run backend python -m pytest tests -v`) resultou em **66 passed**, sem warnings, apos a rodada de correcao do review final (65 herdados das 5 tarefas + 1 teste novo para o teto do dashboard).
- Frontend: `npm test` (Vitest) resultou em **41 testes, 11 arquivos, todos passando**, tanto no host quanto dentro do container `node:22-slim` reconstruido; `npm run build` (`tsc -b && vite build`) concluiu sem erros de tipo, tambem verificado nos dois ambientes.
- Playwright E2E: jornada completa (upload -> dashboard -> entidades -> pendencias -> exportacoes) passando em `desktop-chromium` e `mobile-chromium` contra o stack Docker Compose real, conforme registrado no relatorio da Tarefa 5; comando documentado no `README.md`.
- Alembic: `alembic current` indica `0002_historical_observations (head)`; `alembic check` informa `No new upgrade operations detected`.
- Validacao exploratoria local com dados reais (nao versionados), conforme `docs/specs/001-analise-inadimplencia-crefito11.md`: ~5.331 registros no XLSX atual, ~4.160 nomes normalizados unicos no CSV atual (100% deles existem no XLSX), 1.119 registros do XLSX sem correspondencia no CSV (1.001 Empresa, 137 Profissional), ~22.543 debitos no XLSX, ~41.612 debitos no CSV.

## Trabalho remanescente (candidatos a tarefa de follow-up)

Nenhuma das 5 tarefas do plano tem pendencia bloqueante. Dois itens foram identificados no review final como reducao de escopo deliberada (nao bugs) e ficam registrados como candidatos a uma tarefa futura, caso o usuario queira essa cobertura na interface:

(a) **Divergencias por obrigacao e por conflito de parcelamento entre CSV e XLSX (spec user stories 11/12)**: o backend ja calcula e expoe esses dados (`obrigacoes_somente_csv`/`obrigacoes_somente_xlsx`/`conflitos_parcelamento` em `/api/comparisons`, e alcancaveis via `/api/exports/comparisons`), mas nao existe uma secao dedicada na tela para exibi-los -- hoje so aparecem na exportacao. A tela de Pendencias mostra apenas entidades exclusivas e nomes ambiguos.

(b) **Parcelas em aberto por entidade (spec story 14)**: `total_parcelas_em_aberto_csv` hoje e apenas um indicador escalar global no dashboard, sem quebra por entidade.

Nenhum dos dois foi implementado nesta rodada de correcao -- ambos foram explicitamente deixados de fora pelo controlador do review final, por serem trabalho de UI novo e nao um bug do que ja foi construido.

O plano detalhado esta em [`docs/superpowers/plans/2026-09-15-crefito11-conclusao-sistema.md`](superpowers/plans/2026-09-15-crefito11-conclusao-sistema.md).

## Seguranca

- Os relatorios reais permanecem ignorados pelo Git.
- Arquivos `.env`, volumes Docker e o workspace local de agentes nao sao versionados.
- O projeto e destinado a uso local e nao deve ser exposto diretamente na internet.

