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


def _preparar_entidades(cliente):
    """Duas entidades XLSX (uma com histórico de 2 snapshots), uma pessoa somente-CSV."""
    antigo = _upload_xlsx(
        cliente,
        "hist_20260101_100000.xlsx",
        [
            _linha_xlsx(
                "11111111111",
                "ANA PROFISSIONAL",
                situacao_registro="ATIVO",
                registro="REG ANTIGO",
                debitos=[{"ano": 2025, "tipo": "ANUIDADE", "valor": 80.0}],
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
                situacao_registro="BAIXADO",
                registro="REG ATUAL",
                debitos=[{"ano": 2026, "tipo": "ANUIDADE", "valor": 300.0}],
            ),
            _linha_xlsx(
                "22222222222",
                "EMPRESA DEVEDORA LTDA",
                tipo_pessoa="Empresa",
                categoria="EMPRESA",
                situacao_registro="ATIVO",
                debitos=[{"ano": 2026, "tipo": "MULTA ETICA", "valor": 150.0}],
            ),
            _linha_xlsx(
                "33333333333",
                "JOAO DA SILVA",
                situacao_registro="ATIVO",
                debitos=[{"ano": 2026, "tipo": "ANUIDADE", "valor": 50.0}],
            ),
        ],
    )
    _upload_csv(
        cliente,
        "analitico.csv",
        ["SOMENTE CSV PESSOA;ANUIDADE;2026;0;30/04/2026;Débito"],
    )
    return antigo, atual


def test_busca_entidades_normalizada_ignora_acento_e_caixa(cliente):
    _preparar_entidades(cliente)

    resposta = cliente.get("/api/entities", params={"query": "joao da silva"})
    assert resposta.status_code == 200, resposta.text
    corpo = resposta.json()
    assert [item["nome_normalizado"] for item in corpo["items"]] == ["JOAO DA SILVA"]


def test_busca_entidades_substring_parcial(cliente):
    _preparar_entidades(cliente)

    corpo = cliente.get("/api/entities", params={"query": "devedora"}).json()
    assert [item["nome_normalizado"] for item in corpo["items"]] == ["EMPRESA DEVEDORA LTDA"]


def test_busca_entidades_sem_query_retorna_todas(cliente):
    _preparar_entidades(cliente)

    corpo = cliente.get("/api/entities").json()
    assert corpo["total"] == 3
    nomes = {item["nome_normalizado"] for item in corpo["items"]}
    assert nomes == {"ANA PROFISSIONAL", "EMPRESA DEVEDORA LTDA", "JOAO DA SILVA"}


def test_busca_entidades_sem_correspondencia_retorna_lista_vazia(cliente):
    _preparar_entidades(cliente)

    corpo = cliente.get("/api/entities", params={"query": "NAO EXISTE NINGUEM ASSIM"}).json()
    assert corpo["items"] == []
    assert corpo["total"] == 0
    assert corpo["pages"] == 0


def test_busca_entidades_filtro_tipo_pessoa(cliente):
    _preparar_entidades(cliente)

    corpo = cliente.get("/api/entities", params={"tipo_pessoa": "Empresa"}).json()
    assert [item["nome_normalizado"] for item in corpo["items"]] == ["EMPRESA DEVEDORA LTDA"]


def test_busca_entidades_filtro_situacao_registro_usa_observacao_mais_recente(cliente):
    _preparar_entidades(cliente)

    # ANA PROFISSIONAL era ATIVO no snapshot antigo e passou a BAIXADO no mais
    # recente -- a busca deve refletir apenas o estado cadastral atual.
    ativos = cliente.get("/api/entities", params={"situacao_registro": "ATIVO"}).json()
    nomes_ativos = {item["nome_normalizado"] for item in ativos["items"]}
    assert nomes_ativos == {"EMPRESA DEVEDORA LTDA", "JOAO DA SILVA"}

    baixados = cliente.get("/api/entities", params={"situacao_registro": "BAIXADO"}).json()
    assert [item["nome_normalizado"] for item in baixados["items"]] == ["ANA PROFISSIONAL"]


def test_busca_entidades_csv_only_fica_fora_do_escopo(cliente):
    _preparar_entidades(cliente)

    corpo = cliente.get("/api/entities", params={"query": "SOMENTE CSV PESSOA"}).json()
    assert corpo["items"] == []
    assert corpo["total"] == 0


def test_busca_entidades_documento_mascarado(cliente):
    _preparar_entidades(cliente)

    corpo = cliente.get("/api/entities", params={"query": "ANA"}).json()
    item = corpo["items"][0]
    assert item["cpf_cnpj"] == "***.***.***-11"
    assert "11111111111" not in str(corpo)


def test_busca_entidades_paginacao(cliente):
    _preparar_entidades(cliente)

    pagina_1 = cliente.get("/api/entities", params={"page": 1, "page_size": 2}).json()
    assert pagina_1["total"] == 3
    assert pagina_1["page"] == 1
    assert pagina_1["page_size"] == 2
    assert pagina_1["pages"] == 2
    assert len(pagina_1["items"]) == 2

    pagina_2 = cliente.get("/api/entities", params={"page": 2, "page_size": 2}).json()
    assert len(pagina_2["items"]) == 1

    nomes_pagina_1 = {item["nome_normalizado"] for item in pagina_1["items"]}
    nomes_pagina_2 = {item["nome_normalizado"] for item in pagina_2["items"]}
    assert nomes_pagina_1.isdisjoint(nomes_pagina_2)


def test_entidade_detalhe_historico_por_snapshot(cliente):
    antigo, atual = _preparar_entidades(cliente)

    entidade_id = cliente.get("/api/entities", params={"query": "ANA"}).json()["items"][0]["id"]

    corpo = cliente.get(f"/api/entities/{entidade_id}").json()

    assert corpo["entidade"]["situacao_registro"] == "BAIXADO"
    assert corpo["entidade"]["cpf_cnpj"] == "***.***.***-11"

    assert [o["snapshot_id"] for o in corpo["observacoes"]] == [antigo["id"], atual["id"]]
    assert corpo["observacoes"][0]["situacao_registro"] == "ATIVO"
    assert corpo["observacoes"][0]["registro_resumido"] == "REG ANTIGO"
    assert corpo["observacoes"][1]["situacao_registro"] == "BAIXADO"
    assert corpo["observacoes"][1]["registro_resumido"] == "REG ATUAL"

    assert len(corpo["debitos"]) == 2
    assert {d["origem"] for d in corpo["debitos"]} == {"xlsx"}
    assert [d["snapshot_id"] for d in corpo["debitos"]] == [antigo["id"], atual["id"]]
    assert [d["valor_total"] for d in corpo["debitos"]] == ["80.00", "300.00"]

    assert "11111111111" not in str(corpo)


def test_entidade_detalhe_nao_encontrada_retorna_404(cliente):
    _preparar_entidades(cliente)

    resposta = cliente.get("/api/entities/999999")
    assert resposta.status_code == 404
