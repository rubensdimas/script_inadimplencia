import { test, expect, type Page } from "@playwright/test";
import { construirCsvFixture, construirXlsxFixture } from "./fixtures";

// Jornada ponta a ponta: upload de CSV e XLSX sinteticos, troca de snapshot no
// Dashboard, busca/filtro em Entidades com navegacao ao detalhe historico,
// revisao de Pendencias de pareamento e download de uma exportacao.
//
// Roda contra o stack real (docker compose up -d) -- ver o relatorio da Task 5
// para os comandos operacionais completos. Cada execucao gera nomes/documentos
// sinteticos unicos (sufixo por timestamp) para nao colidir com dados de
// execucoes anteriores nem com a outra rodada de viewport da mesma execucao.

function construirDadosUnicos() {
  const sufixo = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const cpfEntidadeUm = sufixo.slice(-11).padStart(11, "1");
  const cnpjSomenteXlsx = sufixo.slice(-14).padStart(14, "2");
  return {
    sufixo,
    nomeEntidadeUm: `PLAYWRIGHT ENTIDADE UM ${sufixo}`,
    nomeSomenteCsv: `PLAYWRIGHT SOMENTE CSV ${sufixo}`,
    nomeSomenteXlsx: `PLAYWRIGHT SOMENTE XLSX ${sufixo}`,
    cpfEntidadeUm,
    cnpjSomenteXlsx,
  };
}

async function enviarArquivo(
  page: Page,
  regiaoNome: RegExp,
  arquivo: { name: string; mimeType: string; buffer: Buffer },
) {
  const cartao = page.getByRole("region", { name: regiaoNome });
  await cartao.getByLabel(/selecionar arquivo/i).setInputFiles(arquivo);
  await cartao.getByRole("button", { name: /enviar/i }).click();
  await expect(cartao.getByRole("status")).toContainText(arquivo.name, { timeout: 20_000 });
}

/** Seleciona uma opcao do <SnapshotSelect> pelo nome de arquivo (substring),
 * sem depender do texto exato da data formatada ao lado. */
async function selecionarSnapshotPorArquivo(page: Page, rotulo: RegExp, nomeArquivo: string) {
  const select = page.getByLabel(rotulo);
  const valor = await select.locator("option", { hasText: nomeArquivo }).first().getAttribute("value");
  if (!valor) {
    throw new Error(`opcao de snapshot nao encontrada para o arquivo ${nomeArquivo}`);
  }
  await select.selectOption(valor);
}

async function assertValorIndicador(page: Page, rotulo: RegExp, valorEsperado: string) {
  const cartao = page.locator(".cartao-indicador", { hasText: rotulo });
  await expect(cartao.locator(".cartao-valor")).toHaveText(valorEsperado);
}

async function assertSemOverflowHorizontal(page: Page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  // Pequena tolerancia para scrollbars/arredondamento de subpixel.
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
}

test("jornada completa: upload, troca de snapshots, dashboard, busca, pendencias e exportacao", async ({
  page,
}) => {
  const dados = construirDadosUnicos();

  // "total_parcelas_em_aberto_csv" (backend/app/services/analytics.py) so conta
  // linhas cuja situacao normalizada seja "Parcelamento" -- ver
  // backend/app/services/matching.py:CHAVE_PARCELAMENTO_CSV.
  const csvAntigo = construirCsvFixture([
    {
      nome: dados.nomeEntidadeUm,
      tipoDebito: "ANUIDADE",
      ano: 2025,
      parcela: 0,
      vencimento: "30/04/2025",
      situacao: "Parcelamento",
    },
  ]);
  const csvRecente = construirCsvFixture([
    {
      nome: dados.nomeEntidadeUm,
      tipoDebito: "ANUIDADE",
      ano: 2026,
      parcela: 0,
      vencimento: "30/04/2026",
      situacao: "Parcelamento",
    },
    {
      nome: dados.nomeSomenteCsv,
      tipoDebito: "ANUIDADE",
      ano: 2026,
      parcela: 0,
      vencimento: "30/04/2026",
      situacao: "Parcelamento",
    },
  ]);
  const xlsxAtual = await construirXlsxFixture([
    {
      documento: dados.cpfEntidadeUm,
      nome: dados.nomeEntidadeUm,
      tipoPessoa: "Profissional",
      categoria: "PROFISSIONAL",
      subregiao: "DISTRITO FEDERAL",
      situacaoRegistro: "ATIVO",
      registroResumido: "REG PLAYWRIGHT",
      debitos: [{ ano: 2026, tipo: "ANUIDADE", vencimento: new Date(2026, 3, 30), valor: 300 }],
    },
    {
      documento: dados.cnpjSomenteXlsx,
      nome: dados.nomeSomenteXlsx,
      tipoPessoa: "Empresa",
      categoria: "EMPRESA",
      subregiao: "DISTRITO FEDERAL",
      situacaoRegistro: "ATIVO",
      registroResumido: "REG EMPRESA",
      debitos: [{ ano: 2026, tipo: "MULTA ETICA", vencimento: new Date(2026, 3, 30), valor: 150 }],
    },
  ]);

  const nomeCsvAntigo = `playwright-${dados.sufixo}-antigo.csv`;
  const nomeCsvRecente = `playwright-${dados.sufixo}-recente.csv`;
  const nomeXlsx = `playwright-${dados.sufixo}-cadastro.xlsx`;

  await test.step("upload: CSV antigo, CSV recente e XLSX", async () => {
    await page.goto("/uploads");
    await expect(page.getByRole("heading", { name: /uploads/i })).toBeVisible();

    await enviarArquivo(page, /csv/i, { name: nomeCsvAntigo, mimeType: "text/csv", buffer: csvAntigo });
    await enviarArquivo(page, /csv/i, { name: nomeCsvRecente, mimeType: "text/csv", buffer: csvRecente });
    await enviarArquivo(page, /xlsx/i, {
      name: nomeXlsx,
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: xlsxAtual,
    });
  });

  await test.step("dashboard: reflete os dados enviados e reage a troca de snapshot", async () => {
    await page.getByRole("link", { name: /dashboard/i }).click();
    await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible();

    // Seleciona explicitamente o snapshot CSV recente (2 parcelas em aberto).
    await selecionarSnapshotPorArquivo(page, /snapshot csv/i, nomeCsvRecente);
    await assertValorIndicador(page, /parcelas em aberto/i, "2");

    // Troca para o snapshot CSV antigo (1 parcela em aberto) -- valida que o
    // dashboard reage a troca de snapshot, nao so ao carregamento inicial.
    await selecionarSnapshotPorArquivo(page, /snapshot csv/i, nomeCsvAntigo);
    await assertValorIndicador(page, /parcelas em aberto/i, "1");

    // Volta para o snapshot recente para o restante da jornada.
    await selecionarSnapshotPorArquivo(page, /snapshot csv/i, nomeCsvRecente);

    // Ranking reflete as entidades do XLSX enviado.
    await expect(page.getByText(dados.nomeEntidadeUm).first()).toBeVisible();

    await assertSemOverflowHorizontal(page);
  });

  await test.step("entidades: busca, filtra por tipo de pessoa e navega ao detalhe historico", async () => {
    await page.getByRole("link", { name: /entidades/i }).click();
    await expect(page.getByRole("heading", { name: /entidades/i })).toBeVisible();

    await page.getByLabel(/^nome$/i).fill(dados.nomeEntidadeUm);
    await page.getByRole("button", { name: /buscar/i }).click();

    const linhaEntidade = page.getByRole("link", { name: dados.nomeEntidadeUm });
    await expect(linhaEntidade).toBeVisible();

    // Documento aparece mascarado (contem "*"), nunca o valor cru.
    const linhaTabela = page.locator("tr", { hasText: dados.nomeEntidadeUm });
    await expect(linhaTabela).toContainText("*");
    await expect(page.getByText(dados.cpfEntidadeUm, { exact: true })).toHaveCount(0);

    // Filtro por tipo de pessoa: Empresa deve esconder esta entidade (Profissional).
    await page.getByLabel(/tipo de pessoa/i).selectOption("Empresa");
    await page.getByRole("button", { name: /buscar/i }).click();
    await expect(page.getByRole("link", { name: dados.nomeEntidadeUm })).toHaveCount(0);

    // Volta para "Todos" e navega ao detalhe.
    await page.getByLabel(/tipo de pessoa/i).selectOption("");
    await page.getByRole("button", { name: /buscar/i }).click();
    await expect(linhaEntidade).toBeVisible();
    await linhaEntidade.click();

    await expect(page.getByRole("heading", { name: dados.nomeEntidadeUm })).toBeVisible();
    // Historico de debitos entre os dois snapshots XLSX (so ha um aqui, mas
    // confirma que a secao de historico de debitos renderiza valores formatados).
    await expect(page.getByText(/R\$\s*300,00/)).toBeVisible();

    await assertSemOverflowHorizontal(page);
  });

  await test.step("pendencias: separa somente-csv, somente-xlsx e exporta", async () => {
    await page.getByRole("link", { name: /pend[eê]ncias/i }).click();
    await expect(page.getByRole("heading", { name: /pend[eê]ncias/i })).toBeVisible();

    await selecionarSnapshotPorArquivo(page, /snapshot csv/i, nomeCsvRecente);
    await selecionarSnapshotPorArquivo(page, /snapshot xlsx/i, nomeXlsx);

    const secaoSomenteCsv = page.getByRole("region", { name: /somente no csv/i });
    const secaoSomenteXlsx = page.getByRole("region", { name: /somente no xlsx/i });
    await expect(secaoSomenteCsv.getByText(dados.nomeSomenteCsv)).toBeVisible();
    await expect(secaoSomenteXlsx.getByText(dados.nomeSomenteXlsx)).toBeVisible();

    await assertSemOverflowHorizontal(page);

    const grupoExportacao = page.getByRole("group", { name: /exportar pend[eê]ncias/i });
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      grupoExportacao.getByRole("link", { name: /^csv$/i }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/matching-issues.*\.csv$/i);
  });
});
