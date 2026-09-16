from datetime import date

from tests.fixture_builders import construir_xlsx_registros

_DEBITO_PADRAO = dict(
    vencimento=date(2026, 4, 30),
    situacao_pagamento="Nao pago",
    situacao_divida_ativa=None,
    situacao_parcelamento="Nao parcelado",
)


def _bloco_debito(ano, tipo, valor, **overrides):
    dados = {**_DEBITO_PADRAO, **overrides}
    return [
        ano,
        tipo,
        dados["vencimento"],
        valor,
        valor,
        valor,
        dados["situacao_pagamento"],
        dados["situacao_divida_ativa"],
        dados["situacao_parcelamento"],
    ]


def _linha_xlsx(
    documento,
    nome,
    *,
    tipo_pessoa="Profissional",
    categoria="PROFISSIONAL",
    subregiao="DISTRITO FEDERAL",
    situacao_registro="ATIVO",
    registro="REG",
    debitos=None,
    blocos_debito=2,
):
    debitos = debitos or []
    linha = [documento, nome, tipo_pessoa, categoria, subregiao, situacao_registro, registro]
    for debito in debitos:
        extras = {k: v for k, v in debito.items() if k not in ("ano", "tipo", "valor")}
        linha += _bloco_debito(debito["ano"], debito["tipo"], debito["valor"], **extras)
    for _ in range(blocos_debito - len(debitos)):
        linha += [None] * 9
    return linha


def _csv_bytes(linhas: list[str]) -> bytes:
    return ("\n".join(linhas) + "\n").encode("latin-1")


def _upload_xlsx(cliente, nome_arquivo, linhas):
    resposta = cliente.post(
        "/api/uploads/xlsx",
        files={
            "arquivo": (
                nome_arquivo,
                construir_xlsx_registros(linhas),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )
    assert resposta.status_code == 201, resposta.text
    return resposta.json()


def _upload_csv(cliente, nome_arquivo, linhas):
    resposta = cliente.post(
        "/api/uploads/csv",
        files={"arquivo": (nome_arquivo, _csv_bytes(linhas), "text/csv")},
    )
    assert resposta.status_code == 201, resposta.text
    return resposta.json()


def _preparar_dashboard(cliente):
    antigo = _upload_xlsx(
        cliente,
        "hist_20260101_100000.xlsx",
        [
            _linha_xlsx(
                "11111111111",
                "ANA PROFISSIONAL",
                debitos=[{"ano": 2024, "tipo": "ANUIDADE", "valor": 80.0}],
            )
        ],
    )

    atual = _upload_xlsx(
        cliente,
        "atual_20260915_100000.xlsx",
        [
            _linha_xlsx(
                "11111111111",
                "ANA PROFISSIONAL",
                debitos=[
                    {"ano": 2025, "tipo": "ANUIDADE", "valor": 100.0},
                    {
                        "ano": 2026,
                        "tipo": "ANUIDADE",
                        "valor": 300.0,
                        "situacao_divida_ativa": "Administrativa",
                    },
                ],
            ),
            _linha_xlsx(
                "22222222222",
                "EMPRESA DEVEDORA LTDA",
                tipo_pessoa="Empresa",
                categoria="EMPRESA",
                debitos=[
                    {
                        "ano": 2026,
                        "tipo": "MULTA ETICA",
                        "valor": 150.0,
                        "situacao_divida_ativa": "Executiva",
                    }
                ],
            ),
            _linha_xlsx(
                "33333333333",
                "CARLOS PROFISSIONAL",
                debitos=[
                    {
                        "ano": 2026,
                        "tipo": "ANUIDADE",
                        "valor": 50.0,
                        "situacao_pagamento": "Pago a menor",
                    }
                ],
            ),
        ],
    )

    csv = _upload_csv(
        cliente,
        "analitico.csv",
        [
            "ANA PROFISSIONAL;ANUIDADE;2026;1;10/01/2026;Parcelamento",
            "ANA PROFISSIONAL;ANUIDADE;2026;2;10/02/2026;Parcelamento",
            "CARLOS PROFISSIONAL;ANUIDADE;2026;0;10/01/2026;Débito",
        ],
    )

    return antigo, atual, csv


def test_dashboard_indicadores(cliente):
    antigo, atual, csv = _preparar_dashboard(cliente)

    resposta = cliente.get(
        "/api/dashboard", params={"csv_snapshot_id": csv["id"], "xlsx_snapshot_id": atual["id"]}
    )
    assert resposta.status_code == 200, resposta.text
    corpo = resposta.json()

    assert corpo["indicadores"] == {
        "csv_snapshot_id": csv["id"],
        "xlsx_snapshot_id": atual["id"],
        "total_entidades_xlsx": 3,
        "total_obrigacoes_distintas_xlsx": 4,
        "total_valor_total_xlsx": "600.00",
        "total_parcelas_em_aberto_csv": 2,
        "total_debitos_divida_ativa": 2,
        "total_debitos_divida_ativa_executiva": 1,
    }


def test_dashboard_ranking_obrigacoes_distintas(cliente):
    antigo, atual, csv = _preparar_dashboard(cliente)

    corpo = cliente.get(
        "/api/dashboard", params={"csv_snapshot_id": csv["id"], "xlsx_snapshot_id": atual["id"]}
    ).json()

    ranking = corpo["ranking_obrigacoes"]
    assert [(r["entidade"]["nome_normalizado"], r["total_obrigacoes"]) for r in ranking] == [
        ("ANA PROFISSIONAL", 2),
        ("CARLOS PROFISSIONAL", 1),
        ("EMPRESA DEVEDORA LTDA", 1),
    ]


def test_dashboard_ranking_valor_total(cliente):
    antigo, atual, csv = _preparar_dashboard(cliente)

    corpo = cliente.get(
        "/api/dashboard", params={"csv_snapshot_id": csv["id"], "xlsx_snapshot_id": atual["id"]}
    ).json()

    ranking = corpo["ranking_valor_total"]
    assert [(r["entidade"]["nome_normalizado"], r["valor_total"]) for r in ranking] == [
        ("ANA PROFISSIONAL", "400.00"),
        ("EMPRESA DEVEDORA LTDA", "150.00"),
        ("CARLOS PROFISSIONAL", "50.00"),
    ]


def test_dashboard_divida_ativa_prioriza_executiva(cliente):
    antigo, atual, csv = _preparar_dashboard(cliente)

    corpo = cliente.get(
        "/api/dashboard", params={"csv_snapshot_id": csv["id"], "xlsx_snapshot_id": atual["id"]}
    ).json()

    divida_ativa = corpo["divida_ativa"]
    assert [
        (d["entidade"]["nome_normalizado"], d["situacao_divida_ativa"], d["valor_total"])
        for d in divida_ativa
    ] == [
        ("EMPRESA DEVEDORA LTDA", "Executiva", "150.00"),
        ("ANA PROFISSIONAL", "Administrativa", "300.00"),
    ]


def test_dashboard_distribuicoes_ano_tipo_situacao(cliente):
    antigo, atual, csv = _preparar_dashboard(cliente)

    corpo = cliente.get(
        "/api/dashboard", params={"csv_snapshot_id": csv["id"], "xlsx_snapshot_id": atual["id"]}
    ).json()

    assert corpo["distribuicao_ano"] == [
        {"ano_referencia": 2025, "quantidade": 1, "valor_total": "100.00"},
        {"ano_referencia": 2026, "quantidade": 3, "valor_total": "500.00"},
    ]
    assert corpo["distribuicao_tipo"] == [
        {"tipo_debito": "ANUIDADE", "quantidade": 3, "valor_total": "450.00"},
        {"tipo_debito": "MULTA ETICA", "quantidade": 1, "valor_total": "150.00"},
    ]
    assert corpo["distribuicao_situacao_pagamento"] == [
        {"situacao_pagamento": "Nao pago", "quantidade": 3, "valor_total": "550.00"},
        {"situacao_pagamento": "Pago a menor", "quantidade": 1, "valor_total": "50.00"},
    ]


def test_dashboard_distribuicao_situacao_cadastral_cruza_com_debito_em_aberto(cliente):
    xlsx = _upload_xlsx(
        cliente,
        "cadastral_20260915_100000.xlsx",
        [
            _linha_xlsx(
                "11111111111",
                "ATIVO PROFISSIONAL",
                situacao_registro="ATIVO",
                debitos=[{"ano": 2026, "tipo": "ANUIDADE", "valor": 100.0, "situacao_pagamento": "Nao pago"}],
            ),
            _linha_xlsx(
                "22222222222",
                "BAIXADO COM DIVIDA",
                situacao_registro="BAIXADO",
                debitos=[{"ano": 2026, "tipo": "ANUIDADE", "valor": 200.0, "situacao_pagamento": "Nao pago"}],
            ),
            _linha_xlsx(
                "33333333333",
                "BAIXADO QUITADO",
                situacao_registro="BAIXADO",
                debitos=[{"ano": 2026, "tipo": "ANUIDADE", "valor": 50.0, "situacao_pagamento": "Pago"}],
            ),
            _linha_xlsx(
                "44444444444",
                "TRANSFERIDO SEM DEBITO",
                situacao_registro="TRANSFERIDO",
                debitos=[],
            ),
        ],
    )
    csv = _upload_csv(cliente, "cadastral.csv", ["QUALQUER PESSOA;ANUIDADE;2026;0;01/01/2026;Débito"])

    resposta = cliente.get(
        "/api/dashboard", params={"csv_snapshot_id": csv["id"], "xlsx_snapshot_id": xlsx["id"]}
    )
    assert resposta.status_code == 200, resposta.text
    corpo = resposta.json()

    # Story 18: situacao cadastral cruzada com a existencia de debitos em aberto -- por
    # exemplo, profissionais BAIXADOS que ainda possuem divida pendente (BAIXADO COM DIVIDA)
    # devem ser distinguiveis de BAIXADOS que ja quitaram tudo (BAIXADO QUITADO).
    assert corpo["distribuicao_situacao_cadastral"] == [
        {
            "situacao_registro": "BAIXADO",
            "total_entidades": 2,
            "total_com_debito_aberto": 1,
            "total_sem_debito_aberto": 1,
        },
        {
            "situacao_registro": "ATIVO",
            "total_entidades": 1,
            "total_com_debito_aberto": 1,
            "total_sem_debito_aberto": 0,
        },
        {
            "situacao_registro": "TRANSFERIDO",
            "total_entidades": 1,
            "total_com_debito_aberto": 0,
            "total_sem_debito_aberto": 1,
        },
    ]


def test_dashboard_serie_historica_xlsx(cliente):
    antigo, atual, csv = _preparar_dashboard(cliente)

    corpo = cliente.get(
        "/api/dashboard", params={"csv_snapshot_id": csv["id"], "xlsx_snapshot_id": atual["id"]}
    ).json()

    serie = corpo["serie_historica_xlsx"]
    assert [
        (p["snapshot_id"], p["total_entidades"], p["total_valor_total"], p["total_divida_ativa"])
        for p in serie
    ] == [
        (antigo["id"], 1, "80.00", 0),
        (atual["id"], 3, "600.00", 2),
    ]


def test_dashboard_usa_snapshots_mais_recentes_quando_ids_omitidos(cliente):
    antigo, atual, csv = _preparar_dashboard(cliente)

    resposta = cliente.get("/api/dashboard")
    assert resposta.status_code == 200, resposta.text
    indicadores = resposta.json()["indicadores"]
    assert indicadores["xlsx_snapshot_id"] == atual["id"]
    assert indicadores["csv_snapshot_id"] == csv["id"]


def test_dashboard_snapshot_de_tipo_errado_retorna_422(cliente):
    antigo, atual, csv = _preparar_dashboard(cliente)

    resposta = cliente.get(
        "/api/dashboard", params={"csv_snapshot_id": atual["id"], "xlsx_snapshot_id": atual["id"]}
    )
    assert resposta.status_code == 422


def test_dashboard_snapshot_inexistente_retorna_404(cliente):
    antigo, atual, csv = _preparar_dashboard(cliente)

    resposta = cliente.get(
        "/api/dashboard", params={"csv_snapshot_id": csv["id"], "xlsx_snapshot_id": 999999}
    )
    assert resposta.status_code == 404
