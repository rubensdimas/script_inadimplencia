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

## Erros conhecidos evitados (não repetir)

- Margem negativa (`margin.left: -N`) combinada com `YAxis width` apertado corta os
  dígitos mais significativos do rótulo (`"15000"` vira só `"00"` visível). Usar
  `margin.left: 0` e dimensionar `YAxis width` para o maior rótulo esperado.
- Uma tabela larga (várias colunas fixas) sem `overflow-x-auto` próprio estoura a
  largura da página no mobile exatamente como o grid sem coluna base — o mecanismo é
  diferente (tabela não tem "coluna base" de grid), mas o teste é o mesmo: sempre
  conferir a tela mais estreita antes de considerar um componente pronto.
