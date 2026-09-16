from tests.fixture_builders import construir_xlsx_fixture


def test_upload_xlsx_despivota_debitos_e_persiste_dados_cadastrais(cliente):
    conteudo = construir_xlsx_fixture()

    resposta = cliente.post(
        "/uploads/xlsx",
        files={
            "arquivo": (
                "Relatorio_Inadimplentes_Debitos_20260915_205007.xlsx",
                conteudo,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )

    assert resposta.status_code == 201
    snapshot = resposta.json()
    assert snapshot["tipo_arquivo"] == "xlsx"
    assert snapshot["data_snapshot"].startswith("2026-09-15T20:50:07")

    debitos = cliente.get(f"/snapshots/{snapshot['id']}/debitos").json()
    assert len(debitos) == 2

    empresa = next(d for d in debitos if d["valor_total"] == 620.27)
    assert empresa["origem"] == "xlsx"
    assert empresa["numero_parcela"] is None
    assert empresa["data_vencimento"] == "2026-04-30"
    assert empresa["situacao_divida_ativa"] == "Administrativa"
    assert empresa["situacao_parcelamento"] == "Não parcelado"
    assert empresa["entidade"]["tipo_pessoa"] == "Empresa"
    assert empresa["entidade"]["situacao_registro"] == "ATIVO"
    assert empresa["entidade"]["cpf_cnpj"] == "10.852.801/0001-39"

    profissional = next(d for d in debitos if d["valor_total"] == 542.73)
    assert profissional["situacao_pagamento"] == "Pago a menor"
    assert profissional["situacao_divida_ativa"] == "Executiva"
    assert profissional["situacao_parcelamento"] == "Renegociado"
    assert profissional["entidade"]["tipo_pessoa"] == "Profissional"
    assert profissional["entidade"]["situacao_registro"] == "BAIXADO"
