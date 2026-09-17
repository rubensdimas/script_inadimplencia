import { describe, expect, it } from "vitest";

import { agruparObrigacoes, construirChangelogCadastral } from "./historico";

function debito(overrides: Partial<Parameters<typeof agruparObrigacoes>[0][number]>) {
  return {
    id: 1,
    snapshot_id: 1,
    data_snapshot: "2026-08-15T10:00:00Z",
    origem: "xlsx",
    ano_referencia: 2026,
    tipo_debito: "ANUIDADE",
    numero_parcela: null,
    data_vencimento: null,
    valor_original: "600.00",
    valor_devido: "600.00",
    valor_total: "600.00",
    situacao_pagamento: "Não pago",
    situacao_divida_ativa: null,
    situacao_parcelamento: "Não parcelado",
    ...overrides,
  };
}

describe("agruparObrigacoes", () => {
  it("agrupa a mesma obrigacao repetida em varios snapshots numa unica linha", () => {
    const debitos = [
      debito({ id: 1, snapshot_id: 1, data_snapshot: "2026-08-15T10:00:00Z" }),
      debito({ id: 2, snapshot_id: 2, data_snapshot: "2026-09-15T10:00:00Z" }),
    ];

    const resumo = agruparObrigacoes(debitos, 2);

    expect(resumo).toHaveLength(1);
    expect(resumo[0]).toMatchObject({
      anoReferencia: 2026,
      tipoDebito: "ANUIDADE",
      emAberto: true,
      primeiraVez: "2026-08-15T10:00:00Z",
      ultimaVez: "2026-09-15T10:00:00Z",
    });
  });

  it("marca como quitada uma obrigacao que nao aparece no snapshot mais recente", () => {
    const debitos = [
      debito({ id: 1, snapshot_id: 1, data_snapshot: "2026-08-15T10:00:00Z", ano_referencia: 2025 }),
    ];

    const resumo = agruparObrigacoes(debitos, 2);

    expect(resumo[0].emAberto).toBe(false);
    expect(resumo[0].ultimaVez).toBe("2026-08-15T10:00:00Z");
  });

  it("nao mistura anos ou tipos diferentes no mesmo grupo", () => {
    const debitos = [
      debito({ id: 1, ano_referencia: 2025, tipo_debito: "ANUIDADE" }),
      debito({ id: 2, ano_referencia: 2026, tipo_debito: "ANUIDADE" }),
      debito({ id: 3, ano_referencia: 2026, tipo_debito: "MULTA ELEITORAL" }),
    ];

    const resumo = agruparObrigacoes(debitos, 1);

    expect(resumo).toHaveLength(3);
  });

  it("ordena em aberto antes de quitadas e por ano decrescente dentro do mesmo grupo", () => {
    const debitos = [
      debito({ id: 1, snapshot_id: 1, ano_referencia: 2024, tipo_debito: "ANUIDADE" }), // quitada
      debito({ id: 2, snapshot_id: 2, ano_referencia: 2025, tipo_debito: "ANUIDADE" }), // em aberto
      debito({ id: 3, snapshot_id: 2, ano_referencia: 2023, tipo_debito: "ANUIDADE" }), // em aberto
    ];

    const resumo = agruparObrigacoes(debitos, 2);

    expect(resumo.map((r) => [r.anoReferencia, r.emAberto])).toEqual([
      [2025, true],
      [2023, true],
      [2024, false],
    ]);
  });

  it("usa a divida ativa e o valor da ocorrencia mais recente do grupo", () => {
    const debitos = [
      debito({ id: 1, snapshot_id: 1, data_snapshot: "2026-08-15T10:00:00Z", situacao_divida_ativa: null, valor_total: "600.00" }),
      debito({ id: 2, snapshot_id: 2, data_snapshot: "2026-09-15T10:00:00Z", situacao_divida_ativa: "Administrativa", valor_total: "650.00" }),
    ];

    const resumo = agruparObrigacoes(debitos, 2);

    expect(resumo[0].situacaoDividaAtiva).toBe("Administrativa");
    expect(resumo[0].valorTotal).toBe("650.00");
  });
});

function observacao(overrides: Partial<Parameters<typeof construirChangelogCadastral>[0][number]>) {
  return {
    snapshot_id: 1,
    tipo_arquivo: "xlsx",
    data_snapshot: "2026-08-15T10:00:00Z",
    observacao_id: 1,
    nome_original: "Ana Beatriz Costa",
    nome_normalizado: "ANA BEATRIZ COSTA",
    cpf_cnpj: "***.***.***-80",
    tipo_pessoa: "Profissional",
    registro_resumido: "23263-F",
    categoria: "FISIOTERAPEUTA",
    subregiao: "Não informado",
    situacao_registro: "ATIVO",
    ...overrides,
  };
}

describe("construirChangelogCadastral", () => {
  it("sempre inclui a primeira observacao como marco inicial", () => {
    const changelog = construirChangelogCadastral([observacao({})]);

    expect(changelog).toEqual([
      { data: "2026-08-15T10:00:00Z", primeiraObservacao: true, alteracoes: [] },
    ]);
  });

  it("omite snapshots identicos ao anterior", () => {
    const changelog = construirChangelogCadastral([
      observacao({ snapshot_id: 1, data_snapshot: "2026-08-15T10:00:00Z" }),
      observacao({ snapshot_id: 2, data_snapshot: "2026-09-15T10:00:00Z" }),
    ]);

    expect(changelog).toHaveLength(1);
  });

  it("registra uma entrada quando a situacao de registro muda", () => {
    const changelog = construirChangelogCadastral([
      observacao({ snapshot_id: 1, data_snapshot: "2026-08-15T10:00:00Z", situacao_registro: "ATIVO" }),
      observacao({ snapshot_id: 2, data_snapshot: "2026-09-15T10:00:00Z", situacao_registro: "BAIXADO" }),
    ]);

    expect(changelog).toEqual([
      { data: "2026-08-15T10:00:00Z", primeiraObservacao: true, alteracoes: [] },
      {
        data: "2026-09-15T10:00:00Z",
        primeiraObservacao: false,
        alteracoes: [{ rotulo: "Situação", de: "ATIVO", para: "BAIXADO" }],
      },
    ]);
  });

  it("funciona independente da ordem de entrada (ordena por data internamente)", () => {
    const changelog = construirChangelogCadastral([
      observacao({ snapshot_id: 2, data_snapshot: "2026-09-15T10:00:00Z", situacao_registro: "BAIXADO" }),
      observacao({ snapshot_id: 1, data_snapshot: "2026-08-15T10:00:00Z", situacao_registro: "ATIVO" }),
    ]);

    expect(changelog.map((c) => c.data)).toEqual(["2026-08-15T10:00:00Z", "2026-09-15T10:00:00Z"]);
  });
});
