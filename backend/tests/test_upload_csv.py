import os
from datetime import datetime, timezone
from pathlib import Path


def test_upload_csv_cria_snapshot_normaliza_nomes_e_persiste_debitos(cliente):
    conteudo = (
        "JOÃO DA SILVA;ANUIDADE;2024;0;15/03/2024;Débito\n"
        "JOÃO   DA  SILVA;ANUIDADE;2023;1;10/01/2023;Parcelamento\n"
        "JOAO DA SILVA;ANUIDADE;2023;2;10/02/2023;Parcelamento\n"
        "MARIA OLIVEIRA COSTA;ANUIDADE;2022;0;20/05/2022;Débito\n"
    ).encode("latin-1")

    resposta = cliente.post(
        "/api/uploads/csv",
        files={"arquivo": ("relatorio.csv", conteudo, "text/csv")},
    )

    assert resposta.status_code == 201
    snapshot = resposta.json()
    assert snapshot["tipo_arquivo"] == "csv"
    assert snapshot["nome_arquivo_original"] == "relatorio.csv"

    data_snapshot = datetime.fromisoformat(snapshot["data_snapshot"])
    agora = datetime.now(timezone.utc).replace(tzinfo=None)
    assert abs((agora - data_snapshot).total_seconds()) < 30

    snapshots = cliente.get("/api/snapshots").json()
    assert any(s["id"] == snapshot["id"] for s in snapshots)

    debitos = cliente.get(f"/api/snapshots/{snapshot['id']}/debitos").json()["items"]
    assert len(debitos) == 4

    observacao_joao_1 = debitos[0]["entidade"]["observacao_id"]
    observacao_joao_2 = debitos[1]["entidade"]["observacao_id"]
    observacao_joao_3 = debitos[2]["entidade"]["observacao_id"]

    assert observacao_joao_1 == observacao_joao_2 == observacao_joao_3
    assert debitos[0]["entidade"]["id"] is None
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

    # O CSV nao cria identidade canonica: cada snapshot guarda sua propria
    # observacao normalizada, que sera pareada apenas no contexto da analise.
    conteudo_segundo_upload = (
        "JOAO  DA   SILVA;ANUIDADE;2021;0;01/01/2021;Débito\n"
    ).encode("latin-1")

    resposta_2 = cliente.post(
        "/api/uploads/csv",
        files={"arquivo": ("relatorio2.csv", conteudo_segundo_upload, "text/csv")},
    )

    assert resposta_2.status_code == 201
    snapshot_2 = resposta_2.json()

    debitos_2 = cliente.get(f"/api/snapshots/{snapshot_2['id']}/debitos").json()["items"]
    assert len(debitos_2) == 1
    assert debitos_2[0]["entidade"]["id"] is None
    assert debitos_2[0]["entidade"]["observacao_id"] != observacao_joao_1

    # Finding 3: guarda contra a regressao do path traversal (ruling R3). O
    # nome bruto do arquivo deve ser preservado no registro de auditoria, mas
    # o arquivo em disco tem que cair dentro de RAW_UPLOADS_DIR, nunca fora
    # dele.
    nome_malicioso = "../../etc/cron.d/x.csv"
    conteudo_terceiro_upload = (
        "PESSOA QUALQUER;ANUIDADE;2020;0;01/01/2020;Débito\n"
    ).encode("latin-1")

    resposta_3 = cliente.post(
        "/api/uploads/csv",
        files={"arquivo": (nome_malicioso, conteudo_terceiro_upload, "text/csv")},
    )

    assert resposta_3.status_code == 201
    snapshot_3 = resposta_3.json()
    assert snapshot_3["nome_arquivo_original"] == nome_malicioso

    diretorio_uploads = Path(os.environ["RAW_UPLOADS_DIR"])
    caminho_esperado = diretorio_uploads / f"{snapshot_3['id']}_x.csv"
    assert caminho_esperado.is_file()
    assert caminho_esperado.resolve().parent == diretorio_uploads.resolve()
