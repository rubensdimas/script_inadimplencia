# Spec 001 — Análise e Comparação de Inadimplência CREFITO11

**Status**: ready-for-agent

## Problem Statement

O CREFITO11 gera periodicamente dois relatórios de inadimplência com formatos, granularidade e cobertura diferentes: um CSV analítico simples (nome, tipo de débito, ano, parcela, vencimento, status) e um XLSX detalhado por profissional/empresa (dados cadastrais completos + até 37 débitos individuais por registro, com status de pagamento, dívida ativa e parcelamento). Hoje não existe forma automatizada de cruzar essas duas fontes para responder perguntas básicas de gestão da inadimplência: quem tem débito registrado em uma fonte e não na outra, quem concentra mais débitos, quais débitos estão em dívida ativa, como a inadimplência evolui ao longo do tempo, etc. Essa análise, se feita manualmente, é inviável dado o volume (~4.200 profissionais, ~1.000 empresas, ~22.500 débitos individuais) e o formato "largo" do XLSX (colunas repetidas por débito).

## Solution

Um sistema local, rodando inteiramente via Docker Compose (PostgreSQL + backend FastAPI + frontend React), que permite fazer upload recorrente dos dois arquivos (CSV e XLSX), armazena cada upload como um snapshot datado, normaliza e cruza os dados por nome, e apresenta um dashboard com rankings, divergências entre as fontes e evolução histórica da inadimplência. O sistema roda localmente, para uso de uma única pessoa, sem necessidade de autenticação.

## User Stories

1. Como usuário do sistema, quero fazer upload do arquivo CSV de inadimplência pela interface web, para não precisar rodar scripts manualmente.
2. Como usuário do sistema, quero fazer upload do arquivo XLSX de débitos pela interface web, de forma independente do upload do CSV, para poder atualizar cada fonte no seu próprio ritmo.
3. Como usuário do sistema, quero que a data do snapshot seja extraída automaticamente do timestamp no nome do arquivo XLSX quando presente, para não ter que digitar isso manualmente.
4. Como usuário do sistema, quero que, quando o nome do arquivo não tiver timestamp (caso do CSV), a data/hora do upload seja usada como data do snapshot, para que todo upload fique datado de forma consistente.
5. Como usuário do sistema, quero que cada upload seja guardado como um snapshot histórico (não substitua os dados anteriores), para poder comparar a evolução da inadimplência ao longo do tempo.
6. Como usuário do sistema, quero que os arquivos originais enviados (CSV/XLSX) fiquem salvos em disco, associados ao snapshot correspondente, para poder auditar ou reprocessar os dados no futuro sem precisar reenviar os arquivos.
7. Como usuário do sistema, quero que todos os registros das planilhas sejam considerados (profissionais pessoa física e empresas pessoa jurídica), sem filtragem por tipo, para ter uma visão completa da inadimplência.
8. Como usuário do sistema, quero que os nomes de profissionais/empresas sejam normalizados (maiúsculo, sem acentuação, espaços colapsados) antes de qualquer comparação, para que variações de formatação não gerem falsos positivos de divergência.
9. Como usuário do sistema, quero ver a lista de profissionais/empresas que têm débito registrado no CSV mas não aparecem no XLSX do mesmo período, para identificar possíveis inconsistências entre as fontes.
10. Como usuário do sistema, quero ver a lista de profissionais/empresas que têm débito registrado no XLSX mas não aparecem no CSV do mesmo período, para identificar possíveis inconsistências entre as fontes.
11. Como usuário do sistema, quero ver, para uma mesma pessoa/empresa presente nas duas fontes, quais débitos individuais (mesmo ano de referência + tipo de débito) aparecem em uma fonte e não na outra, para detectar lacunas de sincronização entre os relatórios.
12. Como usuário do sistema, quero ver, para um mesmo débito presente nas duas fontes, se há divergência de valor ou de status de pagamento entre CSV e XLSX, para identificar erros de atualização entre os sistemas de origem.
13. Como usuário do sistema, quero ver um ranking dos profissionais/empresas com maior número de débitos distintos (contando obrigações por ano+tipo, não parcelas), para priorizar quem tem mais pendências diferentes em aberto.
14. Como usuário do sistema, quero ver também a contagem de parcelas em aberto por profissional/empresa (métrica secundária, derivada do CSV), para entender o tamanho dos parcelamentos vigentes.
15. Como usuário do sistema, quero ver um ranking dos profissionais/empresas por maior valor total devido (somando valores devidos/totais do XLSX), para priorizar cobrança pelo impacto financeiro.
16. Como usuário do sistema, quero ver quais débitos estão em dívida ativa (situação "Administrativa" ou "Executiva"), destacando os que estão em fase "Executiva" (mais grave), para focar em casos de maior urgência jurídica.
17. Como usuário do sistema, quero ver quais débitos estão parcelados (situação "Renegociado" ou "Exercício corrente") versus em aberto sem parcelamento ("Não parcelado"), para diferenciar quem já negociou de quem não negociou.
18. Como usuário do sistema, quero ver a situação cadastral (ATIVO, BAIXADO, TRANSFERIDO, etc.) cruzada com a existência de débitos em aberto, para identificar, por exemplo, profissionais baixados que ainda possuem dívida pendente.
19. Como usuário do sistema, quero ver a distribuição de débitos por ano de referência, para identificar se a inadimplência está concentrada em anos recentes ou é um problema histórico acumulado.
20. Como usuário do sistema, quero ver a distribuição de débitos por tipo (ANUIDADE, ANUIDADE PROPORCIONAL, ANUIDADE COMPLEMENTAR, MULTA ELEITORAL, MULTA ÉTICA), para entender a composição da inadimplência além das anuidades.
21. Como usuário do sistema, quero ver a evolução de indicadores-chave (nº de inadimplentes, valor total devido, nº de débitos em dívida ativa) entre snapshots ao longo do tempo, para acompanhar tendência de melhora ou piora.
22. Como usuário do sistema, quero ver uma lista de "pendências de pareamento" — nomes que não bateram exatamente entre as duas fontes em um dado snapshot — para revisar manualmente possíveis erros de digitação ou nomes divergentes.
23. Como usuário do sistema, quero que CPF/CNPJ sejam mascarados por padrão nas telas (mostrando apenas os últimos dígitos), para reduzir exposição de dados sensíveis mesmo em uso local.
24. Como usuário do sistema, quero buscar e filtrar profissionais/empresas por nome em uma tabela, para localizar rapidamente uma pessoa/empresa específica e ver seu histórico de débitos.
25. Como usuário do sistema, quero exportar os resultados (rankings, divergências, listas filtradas) em CSV ou Excel, para usar os dados fora do sistema (ex: planilhas de cobrança, relatórios para diretoria).
26. Como usuário do sistema, quero escolher quais dois snapshots (um do CSV, um do XLSX) usar como base para uma comparação específica, para poder analisar períodos diferentes além do par mais recente.

## Implementation Decisions

- **Orquestração**: `docker-compose` com três serviços: `db` (PostgreSQL), `backend` (FastAPI + pandas), `frontend` (React + Vite + TypeScript). Volume dedicado para dados do Postgres e volume dedicado para armazenar os arquivos brutos enviados (`raw_uploads`).
- **Ingestão de arquivos**: dois endpoints de upload independentes (um para CSV, um para XLSX). Cada upload cria um registro de `snapshot` (tipo de arquivo, nome original, data extraída do nome do arquivo ou do momento do upload, caminho do arquivo bruto salvo) e dispara o parsing/normalização para o banco.
- **Parsing do CSV**: leitura com encoding `ISO-8859-1`/`latin-1`, separador `;`, sem cabeçalho — colunas fixas (nome, tipo de débito, ano de referência, número da parcela, data de vencimento, status [`Débito`/`Parcelamento`]).
- **Parsing do XLSX**: leitura da planilha "Dados" (linha de cabeçalho + colunas cadastrais fixas + blocos repetidos `Debitos.N.*`), "despivotando" (unpivot) cada bloco `Debitos.N.*` preenchido em uma linha de débito individual associada à entidade da linha.
- **Normalização de nomes**: função única e compartilhada de normalização (maiúsculo, remoção de acentuação via NFKD, colapso de espaços) usada como chave de pareamento entre entidades do CSV e do XLSX, e entre snapshots ao longo do tempo.
- **Modelo de dados (alto nível)**:
  - `snapshots`: id, tipo de arquivo (csv|xlsx), nome do arquivo original, caminho do arquivo bruto, data do snapshot, data/hora de upload.
  - `entidades`: id, nome normalizado (chave de identidade), nome original mais recente, CPF/CNPJ (nullable, vindo do XLSX), tipo de pessoa (Profissional|Empresa, quando conhecido), categoria/subregião/situação de registro (quando conhecido, vindo do XLSX).
  - `debitos`: id, snapshot_id (FK), entidade_id (FK), origem (csv|xlsx), ano de referência, tipo de débito, número de parcela (nullable, só CSV), data de vencimento, valor original/devido/total (nullable, só XLSX), situação de pagamento, situação de dívida ativa, situação de parcelamento (nullable, quando não informado pela fonte).
- **Motor de comparação**: dado um snapshot CSV e um snapshot XLSX (por padrão, os mais recentes de cada tipo; endpoint permite escolher outros), calcula: entidades só em um lado, débitos (ano+tipo) só em um lado por entidade presente nos dois lados, e divergências de valor/status para débitos correspondentes nos dois lados.
- **Rankings e indicadores**: calculados sobre o snapshot XLSX mais recente (fonte mais rica), com número de débitos = contagem de obrigações distintas (ano+tipo); contagem de parcelas como métrica derivada do CSV mais recente.
- **Evolução histórica**: indicadores agregados (nº de inadimplentes, valor total devido, nº de débitos em dívida ativa) calculados por snapshot do XLSX e expostos em série temporal.
- **Pendências de pareamento**: lista de nomes normalizados presentes em um snapshot recente de um tipo mas ausentes em todos os snapshots recentes do outro tipo, exposta para revisão manual — sem tentativa automática de correspondência aproximada (fuzzy).
- **Mascaramento de CPF/CNPJ**: aplicado na camada de apresentação (API/frontend), mantendo o valor completo persistido no banco.
- **API (contrato de alto nível)**: endpoints para upload de CSV, upload de XLSX, listagem de snapshots, obtenção de insights/rankings (com parâmetros opcionais de snapshot), obtenção de divergências/pareamento, busca de entidades por nome, exportação de resultados em CSV/Excel.
- **Frontend**: páginas de Upload, Dashboard (rankings, dívida ativa, distribuições, evolução histórica), Tabela de entidades (busca/filtro), tela de Pendências de pareamento, e ação de exportação nas telas relevantes.

## Testing Decisions

- **Seam único de teste**: testes de integração no nível da API do backend (FastAPI), subindo a aplicação contra um PostgreSQL de teste (efêmero, via Docker) e fazendo upload de arquivos CSV/XLSX de fixture (pequenos, construídos à mão) através dos endpoints reais.
- **O que testar**: apenas o comportamento externo observável — dado um ou mais uploads de fixture, as respostas dos endpoints de insights/rankings/divergências/exportação devem conter exatamente os valores esperados (calculados manualmente a partir das fixtures). Não testar funções internas de parsing/matching isoladamente como unidades — essas são implementação, não contrato.
- **Fixtures necessárias** (cobrindo os casos já identificados na análise exploratória dos arquivos reais): entidade presente nas duas fontes com dados idênticos; entidade só no CSV; entidade só no XLSX; débito (ano+tipo) presente nas duas fontes com valor/status divergente; entidade com parcelamento (múltiplas parcelas no CSV) e débito único correspondente no XLSX; débito em dívida ativa "Executiva"; entidade do tipo Empresa; entidade com situação cadastral "BAIXADO" e débito em aberto; nomes com acentuação/caixa diferente entre CSV e XLSX que devem casar após normalização.
- **Prior art**: não há testes prévios no projeto (repositório novo); a estrutura de testes de integração deve seguir as convenções padrão do FastAPI (`TestClient`/`httpx`) combinadas com um banco de teste populado por fixture, servindo como referência para specs futuras deste mesmo projeto.

## Out of Scope

- Autenticação, autorização e suporte multiusuário.
- Exposição do sistema fora da máquina local (sem HTTPS, sem domínio público).
- Correspondência aproximada (fuzzy matching) automática de nomes divergentes.
- Edição manual de débitos/entidades dentro do sistema (o sistema é somente leitura/analítico sobre os uploads).
- Exportação em PDF (fica como possível melhoria futura, fora deste escopo inicial).
- Notificações ou alertas automáticos (e-mail, etc.) sobre mudanças de inadimplência.
- Regras de negócio diferenciadas entre Profissionais e Empresas — ambos são tratados de forma unificada nas comparações e rankings.
- Suporte a formatos de arquivo além dos dois já especificados (CSV analítico e XLSX de débitos no formato atual).

## Further Notes

A análise exploratória dos arquivos reais fornecidos (`Relatorio de inadimplencia - Analitico.csv` e `Relatorio_Inadimplentes_Debitos_20260915_205007.xlsx`) já confirmou fatos importantes que devem orientar a construção das fixtures de teste e validar a lógica implementada:

- 100% dos nomes normalizados do CSV atual (4.160 nomes únicos) existem no XLSX atual (5.331 registros); 1.119 registros do XLSX não aparecem no CSV, sendo 1.001 do tipo Empresa e 137 do tipo Profissional — ou seja, o CSV hoje cobre majoritariamente pessoas físicas.
- O XLSX contém tipos de débito além de anuidade (`MULTA ELEITORAL`, `MULTA ÉTICA`, `ANUIDADE COMPLEMENTAR`) que não existem no CSV, e situações de dívida ativa (`Administrativa`, `Executiva`) e de parcelamento (`Renegociado`, `Exercício corrente`, `Não parcelado`) que não têm equivalente direto no CSV.
- Volume de dados atual é pequeno (dezenas de milhares de linhas, poucos MB por arquivo) — não há requisito de performance/escala além do razoável para uma aplicação local de uso único.
