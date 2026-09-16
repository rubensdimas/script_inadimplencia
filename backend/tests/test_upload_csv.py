from datetime import datetime, timezone


def test_upload_csv_cria_snapshot_normaliza_nomes_e_persiste_debitos(cliente):
    conteudo = (
        "JOÃO DA SILVA;ANUIDADE;2024;0;15/03/2024;Débito\n"
        "JOÃO   DA  SILVA;ANUIDADE;2023;1;10/01/2023;Parcelamento\n"
        "JOAO DA SILVA;ANUIDADE;2023;2;10/02/2023;Parcelamento\n"
        "MARIA OLIVEIRA COSTA;ANUIDADE;2022;0;20/05/2022;Débito\n"
    ).encode("latin-1")

    resposta = cliente.post(
        "/uploads/csv",
        files={"arquivo": ("relatorio.csv", conteudo, "text/csv")},
    )

    assert resposta.status_code == 201
    snapshot = resposta.json()
    assert snapshot["tipo_arquivo"] == "csv"
    assert snapshot["nome_arquivo_original"] == "relatorio.csv"

    data_snapshot = datetime.fromisoformat(snapshot["data_snapshot"])
    agora = datetime.now(timezone.utc).replace(tzinfo=None)
    assert abs((agora - data_snapshot).total_seconds()) < 30

    snapshots = cliente.get("/snapshots").json()
    assert any(s["id"] == snapshot["id"] for s in snapshots)

    debitos = cliente.get(f"/snapshots/{snapshot['id']}/debitos").json()
    assert len(debitos) == 4

    entidade_joao_1 = debitos[0]["entidade"]["id"]
    entidade_joao_2 = debitos[1]["entidade"]["id"]
    entidade_joao_3 = debitos[2]["entidade"]["id"]
    entidade_maria = debitos[3]["entidade"]["id"]

    assert entidade_joao_1 == entidade_joao_2 == entidade_joao_3
    assert entidade_maria != entidade_joao_1
    assert debitos[0]["entidade"]["nome_normalizado"] == "JOAO DA SILVA"
    assert debitos[2]["entidade"]["nome_original"] == "JOAO DA SILVA"

    maria = debitos[3]
    assert maria["ano_referencia"] == 2022
    assert maria["numero_parcela"] == 0
    assert maria["situacao_parcelamento"] == "Débito"
    assert maria["data_vencimento"] == "2022-05-20"
    assert maria["origem"] == "csv"

    parcela = debitos[1]
    assert parcela["numero_parcela"] == 1
    assert parcela["situacao_parcelamento"] == "Parcelamento"
    assert parcela["data_vencimento"] == "2023-01-10"
