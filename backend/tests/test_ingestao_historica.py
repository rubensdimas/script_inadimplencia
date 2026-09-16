import os
import subprocess
import sys
from datetime import date
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import text

from app.db import SessionLocal, engine
from app.models import Entidade, ObservacaoEntidade
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


def _debitos(cliente, snapshot_id, **params):
    resposta = cliente.get(f"/api/snapshots/{snapshot_id}/debitos", params=params)
    assert resposta.status_code == 200, resposta.text
    return resposta.json()


def test_documento_canoniza_aliases_e_separa_homonimos(cliente):
    snapshot = _upload_xlsx(
        cliente,
        "historico_20260915_100000.xlsx",
        [
            _linha_xlsx("123.456.789-01", "ANA LIMA", "ATIVO", "REG 1"),
            _linha_xlsx("987.654.321-09", "ANA LIMA", "ATIVO", "REG 2"),
            _linha_xlsx("12345678901", "ANA DE LIMA", "ATIVO", "REG 1-A"),
        ],
    )

    itens = _debitos(cliente, snapshot["id"])["items"]
    ids = [item["entidade"]["id"] for item in itens]

    assert ids[0] != ids[1]
    assert ids[0] == ids[2]
    assert itens[0]["entidade"]["cpf_cnpj"] == "***.***.***-01"
    assert itens[1]["entidade"]["cpf_cnpj"] == "***.***.***-09"
    assert "123.456.789-01" not in str(itens)
    assert "987.654.321-09" not in str(itens)

    with SessionLocal() as sessao:
        assert {entidade.documento_normalizado for entidade in sessao.query(Entidade).all()} == {
            "12345678901",
            "98765432109",
        }
        assert {observacao.cpf_cnpj for observacao in sessao.query(ObservacaoEntidade).all()} == {
            "123.456.789-01",
            "987.654.321-09",
            "12345678901",
        }


def test_atributos_cadastrais_sao_historicos_por_snapshot(cliente):
    primeiro = _upload_xlsx(
        cliente,
        "historico_20260915_100000.xlsx",
        [_linha_xlsx("123.456.789-01", "ANA LIMA", "ATIVO", "REG ANTIGO")],
    )
    segundo = _upload_xlsx(
        cliente,
        "historico_20260916_100000.xlsx",
        [_linha_xlsx("12345678901", "ANA LIMA SILVA", "BAIXADO", "REG NOVO")],
    )

    antigo = _debitos(cliente, primeiro["id"])["items"][0]["entidade"]
    novo = _debitos(cliente, segundo["id"])["items"][0]["entidade"]

    assert antigo["id"] == novo["id"]
    assert (antigo["nome_original"], antigo["situacao_registro"], antigo["registro_resumido"]) == (
        "ANA LIMA", "ATIVO", "REG ANTIGO"
    )
    assert (novo["nome_original"], novo["situacao_registro"], novo["registro_resumido"]) == (
        "ANA LIMA SILVA", "BAIXADO", "REG NOVO"
    )


def test_api_prefixada_filtra_snapshots_e_remove_rotas_legadas(cliente):
    csv = b"ANA LIMA;ANUIDADE;2024;0;15/03/2024;Debito\n"
    resposta_csv = cliente.post("/api/uploads/csv", files={"arquivo": ("a.csv", csv, "text/csv")})
    assert resposta_csv.status_code == 201
    _upload_xlsx(
        cliente,
        "b_20260915_100000.xlsx",
        [_linha_xlsx("12345678901", "ANA LIMA", "ATIVO", "REG 1")],
    )

    snapshots = cliente.get("/api/snapshots", params={"tipo_arquivo": "csv"})
    assert snapshots.status_code == 200
    assert [item["tipo_arquivo"] for item in snapshots.json()] == ["csv"]
    assert cliente.get("/snapshots").status_code == 404
    assert cliente.post("/uploads/csv", files={"arquivo": ("a.csv", csv, "text/csv")}).status_code == 404


def test_debitos_sao_paginados_e_snapshot_ausente_retorna_404(cliente):
    linhas = "".join(
        f"PESSOA {n};ANUIDADE;202{n};0;0{n + 1}/01/202{n};Debito\n" for n in range(5)
    ).encode("latin-1")
    snapshot = cliente.post(
        "/api/uploads/csv", files={"arquivo": ("paginacao.csv", linhas, "text/csv")}
    ).json()

    pagina = _debitos(cliente, snapshot["id"], page=2, page_size=2)

    assert pagina["total"] == 5
    assert pagina["page"] == 2
    assert pagina["page_size"] == 2
    assert pagina["pages"] == 3
    assert [item["ano_referencia"] for item in pagina["items"]] == [2022, 2023]
    assert cliente.get("/api/snapshots/999999/debitos").status_code == 404


def test_uploads_invalidos_retornam_422_sem_persistir_ou_deixar_staging(cliente, tmp_path, monkeypatch):
    monkeypatch.setenv("RAW_UPLOADS_DIR", str(tmp_path))
    csv_invalido = b"linha;com;colunas;insuficientes\n"

    resposta_csv = cliente.post(
        "/api/uploads/csv", files={"arquivo": ("invalido.csv", csv_invalido, "text/csv")}
    )
    resposta_xlsx = cliente.post(
        "/api/uploads/xlsx", files={"arquivo": ("invalido.xlsx", b"nao-e-xlsx", "application/octet-stream")}
    )

    assert resposta_csv.status_code == 422
    assert resposta_xlsx.status_code == 422
    assert cliente.get("/api/snapshots").json() == []
    assert list(tmp_path.rglob("*")) == []


def test_reprocessamento_cli_e_idempotente_e_preserva_snapshot(cliente):
    snapshot = _upload_xlsx(
        cliente,
        "reprocessar_20260915_100000.xlsx",
        [_linha_xlsx("12345678901", "ANA LIMA", "ATIVO", "REG 1")],
    )
    antes = _debitos(cliente, snapshot["id"])
    ambiente = os.environ.copy()

    primeira = subprocess.run(
        [sys.executable, "-m", "app.cli", "reprocessar-snapshots"],
        env=ambiente,
        text=True,
        capture_output=True,
        check=False,
    )
    segunda = subprocess.run(
        [sys.executable, "-m", "app.cli", "reprocessar-snapshots"],
        env=ambiente,
        text=True,
        capture_output=True,
        check=False,
    )

    assert primeira.returncode == 0, primeira.stderr
    assert segunda.returncode == 0, segunda.stderr
    depois = _debitos(cliente, snapshot["id"])
    for pagina in (antes, depois):
        for item in pagina["items"]:
            item.pop("id")
            item["entidade"].pop("observacao_id")
    assert depois == antes
    assert cliente.get("/api/snapshots").json()[0] == snapshot


def test_banco_de_testes_esta_na_revisao_alembic_atual(cliente):
    with SessionLocal() as sessao:
        revisao = sessao.scalar(text("SELECT version_num FROM alembic_version"))

    assert revisao == "0002_historical_observations"


def test_migracao_preserva_snapshots_e_converte_dados_legados(cliente):
    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conexao:
        conexao.execute(text("DROP SCHEMA public CASCADE"))
        conexao.execute(text("CREATE SCHEMA public"))

    config = Config(str(Path(__file__).parents[1] / "alembic.ini"))
    command.upgrade(config, "0001_legacy_baseline")
    with engine.begin() as conexao:
        conexao.execute(
            text(
                "INSERT INTO snapshots "
                "(id, tipo_arquivo, nome_arquivo_original, caminho_arquivo_bruto, data_snapshot, data_upload) "
                "VALUES "
                "(1, 'csv', 'legado.csv', '/tmp/legado.csv', '2026-09-14', '2026-09-14'), "
                "(2, 'xlsx', 'legado.xlsx', '/tmp/legado.xlsx', '2026-09-15', '2026-09-15')"
            )
        )
        conexao.execute(
            text(
                "INSERT INTO entidades "
                "(id, nome_normalizado, nome_original, cpf_cnpj, tipo_pessoa, categoria, subregiao, situacao_registro) "
                "VALUES (1, 'ANA LIMA', 'Ana Lima', '123.456.789-01', 'Profissional', "
                "'PROFISSIONAL', 'DISTRITO FEDERAL', 'ATIVO')"
            )
        )
        conexao.execute(
            text(
                "INSERT INTO debitos "
                "(id, snapshot_id, entidade_id, origem, ano_referencia, tipo_debito) "
                "VALUES (1, 1, 1, 'csv', 2024, 'ANUIDADE'), "
                "(2, 2, 1, 'xlsx', 2025, 'ANUIDADE')"
            )
        )

    command.upgrade(config, "head")
    with engine.connect() as conexao:
        assert conexao.scalar(text("SELECT count(*) FROM snapshots")) == 2
        assert conexao.scalar(text("SELECT count(*) FROM debitos")) == 2
        assert conexao.scalar(text("SELECT count(*) FROM observacoes_entidades")) == 2
        assert conexao.scalar(text("SELECT count(*) FROM entidades")) == 1
        linhas = conexao.execute(
            text(
                "SELECT s.tipo_arquivo, o.entidade_id, o.cpf_cnpj "
                "FROM observacoes_entidades o JOIN snapshots s ON s.id = o.snapshot_id "
                "ORDER BY s.tipo_arquivo"
            )
        ).all()
        proximo_debito = conexao.scalar(
            text(
                "INSERT INTO debitos (observacao_id, origem, ano_referencia, tipo_debito) "
                "SELECT id, 'xlsx', 2026, 'ANUIDADE' FROM observacoes_entidades "
                "ORDER BY id LIMIT 1 RETURNING id"
            )
        )

    assert linhas[0] == ("csv", None, None)
    assert linhas[1][0] == "xlsx"
    assert linhas[1][1] is not None
    assert linhas[1][2] == "123.456.789-01"
    assert proximo_debito == 3
