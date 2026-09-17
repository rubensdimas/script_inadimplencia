import os
from datetime import date
from pathlib import Path

from tests.fixture_builders import construir_xlsx_registros


def _linha_xlsx(documento, nome, situacao, registro, valor=100.0):
    return [
        documento, nome, "Profissional", "PROFISSIONAL", "DISTRITO FEDERAL",
        situacao, registro,
        2026, "ANUIDADE", date(2026, 4, 30), valor, valor, valor,
        "Não pago", "Administrativa", "Não parcelado",
        None, None, None, None, None, None, None, None, None,
    ]


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


def _upload_csv(cliente, nome_arquivo, conteudo: str):
    resposta = cliente.post(
        "/api/uploads/csv",
        files={"arquivo": (nome_arquivo, conteudo.encode("latin-1"), "text/csv")},
    )
    assert resposta.status_code == 201, resposta.text
    return resposta.json()


def test_deletar_snapshot_csv_remove_registro_e_arquivo_bruto(cliente):
    snapshot = _upload_csv(cliente, "relatorio.csv", "JOAO DA SILVA;ANUIDADE;2024;0;15/03/2024;Débito\n")
    caminho = Path(os.environ["RAW_UPLOADS_DIR"]) / f"{snapshot['id']}_relatorio.csv"
    assert caminho.is_file()

    resposta = cliente.delete(f"/api/snapshots/{snapshot['id']}")

    assert resposta.status_code == 204
    assert not caminho.exists()
    assert cliente.get("/api/snapshots").json() == []
    assert cliente.get(f"/api/snapshots/{snapshot['id']}/debitos").status_code == 404


def test_deletar_snapshot_xlsx_remove_entidade_que_fica_orfa(cliente):
    snapshot = _upload_xlsx(
        cliente,
        "debitos.xlsx",
        [_linha_xlsx("12345678901", "ANA LIMA", "ATIVO", "REG 1")],
    )
    debitos = cliente.get(f"/api/snapshots/{snapshot['id']}/debitos").json()["items"]
    entidade_id = debitos[0]["entidade"]["id"]
    assert entidade_id is not None
    assert cliente.get(f"/api/entities/{entidade_id}").status_code == 200

    resposta = cliente.delete(f"/api/snapshots/{snapshot['id']}")

    assert resposta.status_code == 204
    assert cliente.get(f"/api/entities/{entidade_id}").status_code == 404


def test_deletar_snapshot_preserva_entidade_com_observacao_em_outro_snapshot(cliente):
    snapshot_antigo = _upload_xlsx(
        cliente, "debitos1.xlsx", [_linha_xlsx("12345678901", "ANA LIMA", "ATIVO", "REG 1")]
    )
    snapshot_novo = _upload_xlsx(
        cliente, "debitos2.xlsx", [_linha_xlsx("12345678901", "ANA LIMA", "ATIVO", "REG 1")]
    )
    entidade_id = cliente.get(f"/api/snapshots/{snapshot_novo['id']}/debitos").json()["items"][0][
        "entidade"
    ]["id"]

    resposta = cliente.delete(f"/api/snapshots/{snapshot_antigo['id']}")

    assert resposta.status_code == 204
    detalhe = cliente.get(f"/api/entities/{entidade_id}")
    assert detalhe.status_code == 200
    assert len(detalhe.json()["observacoes"]) == 1


def test_deletar_snapshot_inexistente_retorna_404(cliente):
    resposta = cliente.delete("/api/snapshots/999999")

    assert resposta.status_code == 404
