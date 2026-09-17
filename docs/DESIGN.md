# Identidade Visual

Definida na Tarefa 4 (fatia do Dashboard) com o skill `frontend-design`. Cobre todo o
frontend, não só o Dashboard — os tokens abaixo já substituem o placeholder azul
genérico usado na primeira fatia (shell + Uploads).

## Contexto que orientou as escolhas

Ferramenta interna, mono-usuário, para um conselho profissional de saúde (CREFITO11)
acompanhar inadimplência: dados sensíveis (CPF/CNPJ sempre mascarado), severidade
jurídica real (dívida ativa Administrativa/Executiva), comparação entre dois
snapshots datados de fontes independentes (CSV/XLSX). É um instrumento de trabalho
denso em tabelas e números — não uma landing page. A metáfora visual é a de um
registro/ledger administrativo: papel timbrado, cartões como fichas, fios em vez de
sombra, números exatos em vez de abreviados.

## Cor

Tokens em HSL (`--variavel: H S% L%`) definidos em `frontend/src/index.css`,
consumidos via classes Tailwind (`bg-background`, `text-foreground`, etc.) definidas
em `frontend/tailwind.config.js`. Dark mode segue automaticamente por
`prefers-color-scheme`, mesmo grupo de papéis, passos mais claros/escuros conforme a
superfície.

| Papel | Hex (claro) | Uso |
|---|---|---|
| `--background` (paper) | `#E7EBE9` | Fundo da página — cinza-esverdeado frio de papel timbrado, não o creme quente padrão de IA. |
| `--card` (surface) | `#FFFFFF` | Cartões/painéis. Profundidade vem do contraste com o paper + fio (`border`), nunca `box-shadow`. |
| `--foreground` (ink) | `#16211F` | Texto — preto com matiz verde-petróleo real. |
| `--primary` (brand) | `#0E5C52` | Petróleo/verde-selo — nav ativa, barras de magnitude única nos gráficos. |
| `--seal` | `#A9761F` | Latão/ocre — ênfase pontual, reservado (hoje não usado em gráfico, só UI). |
| `--border` (line) | `#C9D1CD` | Fios divisórios. |

### Paleta de status (severidade — sempre ícone + rótulo, nunca só a cor)

Mesmos valores validados pelo skill `dataviz` (`scripts/validate_palette.js`) para
contraste e segurança de daltonismo — não trocar sem revalidar.

| Papel | Hex | Domínio |
|---|---|---|
| `--success` (bom) | `#0ca30c` | Parcelado/regularizado. |
| `--warning` (atenção) | `#fab219` | Situação cadastral encerrada com débito em aberto (BAIXADO/TRANSFERIDO/CANCELADO/SUSPENSO). |
| `--serious` (grave) | `#ec835a` | Dívida ativa **Administrativa**. |
| `--destructive` (crítico) | `#d03b3b` | Dívida ativa **Executiva**. |

### Paleta categórica (tipo de débito — identidade, não ranking)

5 primeiros slots da ordem fixa validada pelo skill `dataviz` (azul → laranja → água
→ amarelo → magenta), mapeados um-a-um aos 5 tipos de débito conhecidos do domínio em
`frontend/src/pages/dashboard/chart-utils.tsx` (`corTipoDebito`). Um tipo fora dessa
lista (nova regra do CREFITO11) cai em cinza neutro em vez de inventar uma cor não
validada. Nunca ciclar ou reatribuir por rank — a cor segue a identidade do tipo.

| Slot | Tipo de débito | Hex (claro) |
|---|---|---|
| 1 | ANUIDADE | `#2a78d6` |
| 2 | ANUIDADE PROPORCIONAL | `#eb6834` |
| 3 | ANUIDADE COMPLEMENTAR | `#1baf7a` |
| 4 | MULTA ELEITORAL | `#eda100` |
| 5 | MULTA ÉTICA | `#e87ba4` |

Validado com `node scripts/validate_palette.js "#2a78d6,#eb6834,#1baf7a,#eda100,#e87ba4" --mode light --surface "#FFFFFF"`
(superfície real dos cartões, não o branco padrão do skill) — passa todos os
critérios; 3 dos 5 tons ficam abaixo de 3:1 de contraste contra a superfície (regra
de alívio), por isso o gráfico de tipo sempre rotula o eixo em vez de depender só da
cor.

## Tipografia

Duas famílias, papéis distintos — carregadas via Google Fonts em `index.html`:

- **"PT Serif"** — títulos de seção (`CardTitle`, `h1` de cada página). Evoca o
  timbre de documento oficial brasileiro; escolha específica ao órgão, não o
  serifado de alto contraste padrão de geração por IA.
- **"Public Sans"** — todo o resto (rótulos, tabelas, navegação, botões, números).
  Desenhada para serviços administrativos, com algarismos tabulares de verdade.
- **"IBM Plex Mono"** — reservado *só* para o CPF/CNPJ mascarado e para IDs técnicos
  de snapshot. Reforça "isto é um dado redigido"; nunca usado por padrão em rótulos
  genéricos.

Números grandes isolados (KPIs do topo do Dashboard) usam a figura **proporcional**
padrão da fonte — nunca `tabular-nums`, que alarga demais um número como "121" em
destaque. `tabular-nums` (classe utilitária `.tabular-figures`) fica reservado para
colunas que precisam alinhar verticalmente (linhas de tabela, ticks de eixo).

Valores monetários no Dashboard são exibidos **por extenso, sem abreviar**
(`R$ 15.146.789`, não `R$ 15,1M`): é uma ferramenta de fiscalização financeira, o
total exato importa mais do que a leitura rápida de um número arredondado. Isso é
uma escolha deliberada, diferente do padrão "auto-compact" do skill `dataviz` — ver
`frontend/src/lib/format.ts`.

## Layout

- Alinhamento à esquerda em todo o app; números alinham à direita dentro de suas
  colunas (convenção de tabela).
- Sem `box-shadow` em lugar nenhum — profundidade vem do contraste paper/surface e
  do fio (`border`). Raio de borda modesto (`--radius: 0.375rem`, ~6px): nem
  cartão-pílula do kit SaaS, nem canto reto de jornal.
- Grids responsivos sempre declaram a coluna base explicitamente
  (`grid-cols-1 ... lg:grid-cols-3`, nunca só `lg:grid-cols-3`): sem uma
  `grid-template-columns` explícita no breakpoint base, o CSS Grid cria colunas
  implícitas do tamanho do conteúdo (não `1fr`), e uma string longa (nome de
  entidade, nome de arquivo) força a página inteira a alargar horizontalmente no
  mobile. Isso já causou um bug real corrigido nesta tarefa — ver
  `frontend/src/pages/dashboard/DashboardPage.tsx`,
  `frontend/src/pages/dashboard/DistribuicoesRow.tsx` e
  `frontend/src/pages/dashboard/SerieHistoricaChart.tsx`.
- Qualquer grid item que possa conter uma string longa e sem espaços precisa de
  `min-w-0` explícito no filho direto do grid — sem isso, mesmo com a coluna base
  correta, o conteúdo pode forçar a trilha além da fração desejada.

## Gráficos (Dashboard)

Construídos com Recharts seguindo o skill `dataviz`:

- Um eixo por gráfico — nunca dois eixos Y. A série histórica (entidades × valor ×
  dívida ativa, escalas incompatíveis) é 3 pequenos múltiplos, não um gráfico com
  eixos duplos.
- Barra com `dataKey="quantidade"` (contagem); `valor_total` aparece só no tooltip —
  a magnitude visual e o valor monetário nunca competem pelo mesmo eixo.
- `isAnimationActive={false}` em todo `Bar`/`Area`: decisão dupla — motion não
  informa nenhuma ação do usuário aqui (só decoração de carregamento de página, o
  que o skill `frontend-design` pede para evitar), e a animação de entrada padrão do
  Recharts não resolve de forma confiável em captura headless/CI (Chrome com
  `--virtual-time-budget` trava a animação no frame inicial, dando falso-negativo de
  "gráfico vazio" em verificação visual).
- Tooltip customizado (`ChartTooltip` em `chart-utils.tsx`) no vocabulário visual do
  app — nunca o balão branco padrão do Recharts.

## Padrões reutilizáveis entre telas

- `src/components/SnapshotPicker.tsx` — par de seletores CSV/XLSX; usado pelo
  Dashboard e por Pendências (ambos comparam um par de snapshots). Foi movido de
  `pages/dashboard/` para `components/` quando ganhou o segundo uso — mover só
  quando um segundo consumidor real aparece, não antecipadamente.
- `src/lib/situacao-registro.ts` (`ehSituacaoDeAtencao`) — mesma regra usada no
  cruzamento situação cadastral × débito (Dashboard) e nas linhas de pendência: uma
  entidade com registro já encerrado (BAIXADO/TRANSFERIDO/CANCELADO/SUSPENSO) ganha
  o badge `warning`, nunca decorativo.
- `src/lib/normalizar.ts` (`normalizarTexto`) — mesma normalização de nome do
  backend (maiúsculo, sem acento), usada tanto para colorir por tipo de débito
  quanto para o filtro de busca em Pendências, para que buscar "jose" encontre
  "José" como o backend também encontraria.
- Tabs (`src/components/ui/tabs.tsx`) só se justificam quando o conteúdo é
  categorias genuinamente distintas que a pessoa revisa em momentos separados — em
  Pendências, "somente CSV" (0), "somente XLSX" (1.138) e "nomes ambíguos" (28) têm
  volumes tão diferentes que uma lista única seria dominada pelo maior grupo.
- Uma comparação lado a lado com o mesmo conjunto fixo de atributos (candidatos de
  um nome ambíguo) é o caso legítimo de usar `<table>` — não é o "meta separado por
  ponto médio" genérico, é uma estrutura real de colunas comparáveis. Envolver a
  tabela em `overflow-x-auto` (não empilhar as colunas) preserva o alinhamento que
  torna a comparação possível, mesmo em mobile.
- Uma lista que existe para o usuário *revisar item a item* (Pendências) leva busca
  por nome, não corte para "top N" — ao contrário de um ranking (Dashboard), onde só
  os primeiros importam. A pergunta que decide entre as duas é "a pessoa precisa
  processar tudo, ou só ver quem está no topo?".

- `situacao_divida_ativa` de um débito não é um booleano — só `"Administrativa"` e
  `"Executiva"` são divida ativa de verdade; o campo também carrega valores como
  `"Não lançado"` quando o débito nunca entrou em cobrança (o caso comum, não uma
  situação grave). Usar `ehDividaAtiva()` (`src/lib/divida-ativa.ts`), nunca
  `situacao ? <Badge>... : null` direto — isso já pintou um badge de "atenção" no
  débito mais comum e inofensivo do histórico de uma entidade.
- **Presença/ausência como o próprio dado, não um status explícito**: o XLSX do
  CREFITO11 só lista quem está inadimplente — não existe um valor "Pago" no arquivo.
  Um débito quitado não muda de status, ele *desaparece* do snapshot seguinte; uma
  entidade totalmente regularizada desaparece do relatório inteiro. Isso significa
  que "histórico" aqui não é uma lista de eventos (como um changelog convencional),
  e sim uma serie de retratos onde a ausência é a informação — agrupar por
  identidade (ano + tipo de débito) e derivar a situação por presença no snapshot
  mais recente (`agruparObrigacoes` em `pages/entidades/historico.ts`) é o que
  transforma "a mesma linha repetida a cada snapshot" (lida como duplicação) em
  "quando isso foi resolvido". O mesmo raciocínio vale no nível da entidade: ela
  sumir do snapshot XLSX mais recente do *sistema* (não só do snapshot mais recente
  em que ela apareceu) é o sinal mais forte de regularização total, e vale um aviso
  explícito na tela, não silêncio.
- **Dado cadastral quase nunca muda — não repita, mostre só a mudança**: listar uma
  entrada por snapshot para um campo estável (nome, categoria, situação de
  registro) é ruído quase sempre idêntico. Um changelog que só registra uma entrada
  quando algo difere do snapshot anterior (`construirChangelogCadastral`) deixa a
  mudança de verdade (ex.: ATIVO → BAIXADO) visível em vez de perdida em repetição.
- **`<details>`/`<summary>` nativo para dado bruto de auditoria**: quando um resumo
  (agrupado ou filtrado) substitui a visão de "uma linha por snapshot" como a leitura
  padrão, a visão bruta ainda vale a pena manter — é uma ferramenta de fiscalização
  financeira, descartar a granularidade de auditoria é uma perda desnecessária. Um
  `<details>` fechado por padrão custa zero estado de React e é acessível de graça;
  não construir um componente de disclosure novo para isso.

## Erros conhecidos evitados (não repetir)

- Margem negativa (`margin.left: -N`) combinada com `YAxis width` apertado corta os
  dígitos mais significativos do rótulo (`"15000"` vira só `"00"` visível). Usar
  `margin.left: 0` e dimensionar `YAxis width` para o maior rótulo esperado.
- Uma tabela larga (várias colunas fixas) sem `overflow-x-auto` próprio estoura a
  largura da página no mobile exatamente como o grid sem coluna base — o mecanismo é
  diferente (tabela não tem "coluna base" de grid), mas o teste é o mesmo: sempre
  conferir a tela mais estreita antes de considerar um componente pronto.
- Um `<input type="file">` nativo tem uma largura mínima intrínseca (o texto
  "Nenhum arquivo escolhido" não encolhe nem quebra linha, e não é algo que CSS
  consiga truncar) — isso por si só não é o problema; o problema de novo é um grid
  ancestral sem coluna base explícita (`grid gap-6 md:grid-cols-2` em vez de
  `grid grid-cols-1 gap-6 md:grid-cols-2`), que deixa essa largura mínima vazar para
  a página inteira. Esse bug já existia em Uploads desde a Tarefa 4 fatia 1, sem
  ninguém notar, porque a tela nunca tinha sido conferida em largura estreita depois
  daquela fatia — a lição não é só "declare a coluna base", é "depois de aprender um
  padrão de bug, faça uma varredura (`grep`) nas telas mais antigas do projeto em vez
  de confiar que elas já estavam certas".
- **O headless Chrome (`--window-size`) tem um piso de viewport de ~500px**: pedir
  uma largura menor (390px, 420px) não redimensiona o layout de verdade — a página é
  desenhada a ~500px e o PNG só é recortado no tamanho pedido, fazendo qualquer coisa
  perto da borda direita parecer cortada mesmo sem bug nenhum. Isso gerou uma sessão
  inteira de investigação de um "vazamento" em Entidades que não existia (confirmado
  injetando `window.innerWidth`/`scrollWidth` como texto na própria página: ambos
  bateram em 500, sem elemento mais largo que a viewport). **Nunca testar mobile via
  `--window-size` abaixo de ~500px** — usar 500px como o piso confiável, e se for
  preciso confirmar uma largura menor de verdade, medir `document.documentElement.
  scrollWidth` via um elemento de depuração temporário em vez de confiar no recorte
  visual do screenshot.
