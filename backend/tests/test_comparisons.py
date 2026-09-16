from datetime import date

from tests.fixture_builders import construir_xlsx_registros

_DEBITO_PADRAO = dict(
    vencimento=date(2026, 4, 30),
    valor=100.0,
    situacao_pagamento="Nao pago",
    situacao_divida_ativa=None,
    situacao_parcelamento="Nao parcelado",
)


def _bloco_debito(ano, tipo, **overrides):
    dados = {**_DEBITO_PADRAO, **overrides}
    return [
        ano,
        tipo,
        dados["vencimento"],
        dados["valor"],
        dados["valor"],
        dados["valor"],
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
        extras = {k: v for k, v in debito.items() if k not in ("ano", "tipo")}
        linha += _bloco_debito(debito["ano"], debito["tipo"], **extras)
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


def _preparar_par_completo(cliente):
    xlsx = _upload_xlsx(
        cliente,
        "debitos_20260915_100000.xlsx",
        [
            _linha_xlsx(
                "11111111111",
                "ANA LIMA",
                debitos=[
                    {"ano": 2026, "tipo": "ANUIDADE"},
                    {"ano": 2026, "tipo": "ANUIDADE COMPLEMENTAR"},
                ],
            ),
            _linha_xlsx(
                "22222222222",
                "LUCAS SOARES MAIA",
                debitos=[
                    {
                        "ano": 2026,
                        "tipo": "ANUIDADE",
                        "situacao_parcelamento": "Renegociado",
                        "situacao_divida_ativa": "Executiva",
                    }
                ],
            ),
            _linha_xlsx(
                "33333333333",
                "EMPRESA CONFLITO LTDA",
                tipo_pessoa="Empresa",
                categoria="EMPRESA",
                debitos=[{"ano": 2026, "tipo": "ANUIDADE", "situacao_parcelamento": "Renegociado"}],
            ),
            _linha_xlsx(
                "44444444444",
                "SOMENTE XLSX PESSOA",
                debitos=[{"ano": 2026, "tipo": "ANUIDADE"}],
            ),
            _linha_xlsx(
                "55555555555",
                "JOAO DA SILVA",
                situacao_registro="BAIXADO",
                debitos=[{"ano": 2026, "tipo": "ANUIDADE"}],
            ),
            _linha_xlsx(
                "66666666666",
                "CARLOS SOUZA",
                debitos=[{"ano": 2026, "tipo": "ANUIDADE"}],
            ),
            _linha_xlsx(
                "77777777777",
                "CARLOS SOUZA",
                debitos=[{"ano": 2026, "tipo": "ANUIDADE"}],
            ),
        ],
    )

    csv = _upload_csv(
        cliente,
        "analitico.csv",
        [
            "ANA LIMA;ANUIDADE;2026;0;30/04/2026;Débito",
            "ANA LIMA;MULTA ETICA;2026;0;30/04/2026;Parcelamento",
            "SOMENTE CSV PESSOA;ANUIDADE;2026;0;30/04/2026;Débito",
            "LUCAS SOARES MAIA;ANUIDADE;2026;1;30/04/2026;Parcelamento",
            "LUCAS SOARES MAIA;ANUIDADE;2026;2;30/04/2026;Parcelamento",
            "EMPRESA CONFLITO LTDA;ANUIDADE;2026;0;30/04/2026;Débito",
            "João da Silva;ANUIDADE;2026;0;30/04/2026;Débito",
            "CARLOS SOUZA;ANUIDADE;2026;0;30/04/2026;Débito",
        ],
    )

    return csv, xlsx


def test_comparacao_resumo_contagens(cliente):
    csv, xlsx = _preparar_par_completo(cliente)

    resposta = cliente.get(
        "/api/comparisons", params={"csv_snapshot_id": csv["id"], "xlsx_snapshot_id": xlsx["id"]}
    )
    assert resposta.status_code == 200, resposta.text
    corpo = resposta.json()

    assert corpo["resumo"] == {
        "csv_snapshot_id": csv["id"],
        "xlsx_snapshot_id": xlsx["id"],
        "total_csv": 6,
        "total_xlsx": 7,
        "total_pareados": 4,
        "total_somente_csv": 1,
        "total_somente_xlsx": 1,
        "total_nomes_ambiguos": 1,
        "total_obrigacoes_somente_csv": 1,
        "total_obrigacoes_somente_xlsx": 1,
        "total_conflitos_parcelamento": 1,
    }


def test_comparacao_entidades_exclusivas(cliente):
    csv, xlsx = _preparar_par_completo(cliente)

    corpo = cliente.get(
        "/api/comparisons", params={"csv_snapshot_id": csv["id"], "xlsx_snapshot_id": xlsx["id"]}
    ).json()

    assert [e["nome_normalizado"] for e in corpo["entidades_somente_csv"]] == ["SOMENTE CSV PESSOA"]
    assert corpo["entidades_somente_csv"][0]["id"] is None

    assert [e["nome_normalizado"] for e in corpo["entidades_somente_xlsx"]] == ["SOMENTE XLSX PESSOA"]
    assert corpo["entidades_somente_xlsx"][0]["id"] is not None
    assert corpo["entidades_somente_xlsx"][0]["cpf_cnpj"] == "***.***.***-44"


def test_comparacao_obrigacoes_exclusivas_por_entidade_pareada(cliente):
    csv, xlsx = _preparar_par_completo(cliente)

    corpo = cliente.get(
        "/api/comparisons", params={"csv_snapshot_id": csv["id"], "xlsx_snapshot_id": xlsx["id"]}
    ).json()

    assert len(corpo["obrigacoes_somente_csv"]) == 1
    obrigacao_csv = corpo["obrigacoes_somente_csv"][0]
    assert obrigacao_csv["entidade"]["nome_normalizado"] == "ANA LIMA"
    assert obrigacao_csv["entidade"]["id"] is not None
    assert obrigacao_csv["ano_referencia"] == 2026
    assert obrigacao_csv["tipo_debito"] == "MULTA ETICA"

    assert len(corpo["obrigacoes_somente_xlsx"]) == 1
    obrigacao_xlsx = corpo["obrigacoes_somente_xlsx"][0]
    assert obrigacao_xlsx["entidade"]["nome_normalizado"] == "ANA LIMA"
    assert obrigacao_xlsx["tipo_debito"] == "ANUIDADE COMPLEMENTAR"


def test_comparacao_conflito_de_parcelamento(cliente):
    csv, xlsx = _preparar_par_completo(cliente)

    corpo = cliente.get(
        "/api/comparisons", params={"csv_snapshot_id": csv["id"], "xlsx_snapshot_id": xlsx["id"]}
    ).json()

    assert len(corpo["conflitos_parcelamento"]) == 1
    conflito = corpo["conflitos_parcelamento"][0]
    assert conflito["entidade"]["nome_normalizado"] == "EMPRESA CONFLITO LTDA"
    assert conflito["ano_referencia"] == 2026
    assert conflito["tipo_debito"] == "ANUIDADE"
    assert conflito["parcelado_csv"] is False
    assert conflito["parcelado_xlsx"] is True

    # Parcelamento CSV (varias parcelas) casado com Renegociado XLSX nao e conflito.
    nomes_em_conflito = {c["entidade"]["nome_normalizado"] for c in corpo["conflitos_parcelamento"]}
    assert "LUCAS SOARES MAIA" not in nomes_em_conflito


def test_comparacao_nome_ambiguo_nao_associa_documento(cliente):
    csv, xlsx = _preparar_par_completo(cliente)

    corpo = cliente.get(
        "/api/comparisons", params={"csv_snapshot_id": csv["id"], "xlsx_snapshot_id": xlsx["id"]}
    ).json()

    assert len(corpo["nomes_ambiguos"]) == 1
    ambiguo = corpo["nomes_ambiguos"][0]
    assert ambiguo["nome_normalizado"] == "CARLOS SOUZA"
    assert len(ambiguo["candidatos_xlsx"]) == 2
    documentos_mascarados = {c["cpf_cnpj"] for c in ambiguo["candidatos_xlsx"]}
    assert documentos_mascarados == {"***.***.***-66", "***.***.***-77"}
    entidades_distintas = {c["id"] for c in ambiguo["candidatos_xlsx"]}
    assert len(entidades_distintas) == 2

    # Nenhum dos documentos completos deve vazar na resposta.
    assert "66666666666" not in str(corpo)
    assert "77777777777" not in str(corpo)


def test_comparacao_nomes_batem_apos_normalizacao_de_acento_e_caixa(cliente):
    csv, xlsx = _preparar_par_completo(cliente)

    corpo = cliente.get(
        "/api/comparisons", params={"csv_snapshot_id": csv["id"], "xlsx_snapshot_id": xlsx["id"]}
    ).json()

    nomes_somente_csv = {e["nome_normalizado"] for e in corpo["entidades_somente_csv"]}
    nomes_somente_xlsx = {e["nome_normalizado"] for e in corpo["entidades_somente_xlsx"]}
    assert "JOAO DA SILVA" not in nomes_somente_csv
    assert "JOAO DA SILVA" not in nomes_somente_xlsx


def test_comparacao_usa_snapshots_mais_recentes_quando_ids_omitidos(cliente):
    _upload_csv(cliente, "csv_antigo.csv", ["ANTIGO;ANUIDADE;2025;0;01/01/2025;Débito"])
    _upload_xlsx(
        cliente,
        "xlsx_antigo_20260101_100000.xlsx",
        [_linha_xlsx("11111111111", "ANTIGO XLSX", debitos=[{"ano": 2025, "tipo": "ANUIDADE"}])],
    )
    csv_recente = _upload_csv(cliente, "csv_recente.csv", ["RECENTE;ANUIDADE;2026;0;01/01/2026;Débito"])
    xlsx_recente = _upload_xlsx(
        cliente,
        "xlsx_recente_20260915_100000.xlsx",
        [_linha_xlsx("22222222222", "RECENTE XLSX", debitos=[{"ano": 2026, "tipo": "ANUIDADE"}])],
    )

    resposta = cliente.get("/api/comparisons")
    assert resposta.status_code == 200, resposta.text
    resumo = resposta.json()["resumo"]
    assert resumo["csv_snapshot_id"] == csv_recente["id"]
    assert resumo["xlsx_snapshot_id"] == xlsx_recente["id"]


def test_comparacao_snapshot_de_tipo_errado_retorna_422(cliente):
    csv, xlsx = _preparar_par_completo(cliente)

    resposta = cliente.get(
        "/api/comparisons", params={"csv_snapshot_id": xlsx["id"], "xlsx_snapshot_id": xlsx["id"]}
    )
    assert resposta.status_code == 422


def test_comparacao_snapshot_inexistente_retorna_404(cliente):
    csv, xlsx = _preparar_par_completo(cliente)

    resposta = cliente.get(
        "/api/comparisons", params={"csv_snapshot_id": 999999, "xlsx_snapshot_id": xlsx["id"]}
    )
    assert resposta.status_code == 404
