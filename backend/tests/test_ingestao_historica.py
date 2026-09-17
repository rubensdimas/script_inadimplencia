import os
import subprocess
import sys
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import inspect as sa_inspect
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.db import SessionLocal, engine
from app.errors import ErroIngestao
from app.models import Debito, Entidade, ObservacaoEntidade, Snapshot
from app.parsers.xlsx_parser import parse_xlsx
from app.services import ingestion
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


def test_valores_monetarios_xlsx_usam_decimal_sem_erro_binario():
    conteudo = construir_xlsx_registros(
        [_linha_xlsx("12345678901", "ANA LIMA", "ATIVO", "REG 1", valor=0.1)]
    )

    debito = parse_xlsx(conteudo)[0].debitos[0]
    valores = [debito.valor_original, debito.valor_devido, debito.valor_total]

    assert all(isinstance(valor, Decimal) for valor in valores)
    assert sum(valores, Decimal("0")) == Decimal("0.3")


def test_upload_xlsx_rejeita_documento_em_branco(cliente):
    conteudo = construir_xlsx_registros(
        [_linha_xlsx(None, "ANA LIMA", "ATIVO", "REG 1")]
    )

    resposta = cliente.post(
        "/api/uploads/xlsx",
        files={"arquivo": ("sem-documento.xlsx", conteudo, "application/octet-stream")},
    )

    assert resposta.status_code == 422
    assert cliente.get("/api/snapshots").json() == []


def test_upload_xlsx_pula_linha_com_documento_invalido_e_persiste_as_demais(cliente):
    snapshot = _upload_xlsx(
        cliente,
        "documento-invalido_20260915_100000.xlsx",
        [
            _linha_xlsx("12345678901", "ANA LIMA", "ATIVO", "REG 1"),
            _linha_xlsx("123456", "DOC INVALIDO", "ATIVO", "REG 2"),
            _linha_xlsx("98765432100", "JOAO SILVA", "ATIVO", "REG 3"),
        ],
    )

    assert snapshot["linhas_invalidas"] == [
        "linha 3 (DOC INVALIDO): CPF/CNPJ deve conter 11 ou 14 digitos"
    ]
    itens = _debitos(cliente, snapshot["id"])["items"]
    assert len(itens) == 2


def test_reprocessamento_de_snapshot_com_linha_invalida_nao_diverge(cliente):
    snapshot = _upload_xlsx(
        cliente,
        "reprocessar-com-invalida_20260915_100000.xlsx",
        [
            _linha_xlsx("12345678901", "ANA LIMA", "ATIVO", "REG 1"),
            _linha_xlsx("123456", "DOC INVALIDO", "ATIVO", "REG 2"),
        ],
    )

    with SessionLocal() as sessao:
        snapshot_modelo = sessao.get(Snapshot, snapshot["id"])
        ingestion.reprocessar_snapshot(sessao, snapshot_modelo)

    itens = _debitos(cliente, snapshot["id"])["items"]
    assert len(itens) == 1


def test_upload_xlsx_aborta_quando_todas_as_linhas_tem_documento_invalido(cliente):
    conteudo = construir_xlsx_registros(
        [_linha_xlsx("123456", "DOC INVALIDO", "ATIVO", "REG 1")]
    )

    resposta = cliente.post(
        "/api/uploads/xlsx",
        files={"arquivo": ("todas-invalidas.xlsx", conteudo, "application/octet-stream")},
    )

    assert resposta.status_code == 422
    assert cliente.get("/api/snapshots").json() == []


def test_falha_apos_commit_nao_remove_arquivo_bruto_confirmado(cliente, tmp_path, monkeypatch):
    monkeypatch.setenv("RAW_UPLOADS_DIR", str(tmp_path))
    refresh_original = Session.refresh

    def falhar_ao_atualizar_snapshot(sessao, instancia, *args, **kwargs):
        if isinstance(instancia, Snapshot):
            raise RuntimeError("falha sintetica depois do commit")
        return refresh_original(sessao, instancia, *args, **kwargs)

    monkeypatch.setattr(Session, "refresh", falhar_ao_atualizar_snapshot)
    conteudo = b"ANA LIMA;ANUIDADE;2024;0;15/03/2024;Debito\n"

    with pytest.raises(RuntimeError, match="depois do commit"):
        cliente.post(
            "/api/uploads/csv",
            files={"arquivo": ("persistido.csv", conteudo, "text/csv")},
        )

    with SessionLocal() as sessao:
        snapshot = sessao.scalar(select(Snapshot))
        assert snapshot is not None
        assert Path(snapshot.caminho_arquivo_bruto).is_file()


def test_reprocessamento_reverte_quando_contagem_persistida_diverge(cliente, monkeypatch):
    snapshot = _upload_xlsx(
        cliente,
        "reprocessar-divergencia_20260915_100000.xlsx",
        [_linha_xlsx("12345678901", "ANA LIMA", "ATIVO", "REG 1")],
    )
    antes = _debitos(cliente, snapshot["id"])
    persistir_original = ingestion._persistir_xlsx

    def persistir_sem_um_debito(sessao, snapshot_modelo, registros):
        contagens = persistir_original(sessao, snapshot_modelo, registros)
        debito_pendente = next(item for item in sessao.new if isinstance(item, Debito))
        debito_pendente.observacao.debitos.remove(debito_pendente)
        return contagens

    monkeypatch.setattr(ingestion, "_persistir_xlsx", persistir_sem_um_debito)

    with SessionLocal() as sessao:
        snapshot_modelo = sessao.get(Snapshot, snapshot["id"])
        with pytest.raises(ErroIngestao, match="contagens divergentes"):
            ingestion.reprocessar_snapshot(sessao, snapshot_modelo)

    assert _debitos(cliente, snapshot["id"]) == antes


def test_reprocessamento_isola_falha_de_um_snapshot_e_continua_os_demais(cliente, tmp_path, monkeypatch):
    monkeypatch.setenv("RAW_UPLOADS_DIR", str(tmp_path))

    primeiro = _upload_xlsx(
        cliente,
        "boa1_20260915_100000.xlsx",
        [_linha_xlsx("12345678901", "ANA LIMA", "ATIVO", "REG 1")],
    )

    conteudo_ruim = construir_xlsx_registros(
        [_linha_xlsx(None, "SEM DOCUMENTO", "ATIVO", "REG 2")]
    )
    caminho_ruim = tmp_path / "snapshot-legado-sem-documento.xlsx"
    caminho_ruim.write_bytes(conteudo_ruim)
    with SessionLocal() as sessao:
        snapshot_ruim = Snapshot(
            tipo_arquivo="xlsx",
            nome_arquivo_original="legado-sem-documento.xlsx",
            caminho_arquivo_bruto=str(caminho_ruim),
            data_snapshot=datetime(2026, 9, 14),
            data_upload=datetime(2026, 9, 14),
        )
        sessao.add(snapshot_ruim)
        sessao.commit()
        id_ruim = snapshot_ruim.id

    terceiro = _upload_xlsx(
        cliente,
        "boa3_20260917_100000.xlsx",
        [_linha_xlsx("98765432100", "JOAO SILVA", "ATIVO", "REG 3")],
    )

    with SessionLocal() as sessao:
        resultado = ingestion.reprocessar_todos_snapshots(sessao)

    assert resultado.sucesso == [primeiro["id"], terceiro["id"]]
    assert list(resultado.falhas.keys()) == [id_ruim]
    assert "CPF/CNPJ" in resultado.falhas[id_ruim]


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


def test_migracao_upgrade_direto_a_partir_de_banco_legado_sem_alembic_version(cliente):
    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conexao:
        conexao.execute(text("DROP SCHEMA public CASCADE"))
        conexao.execute(text("CREATE SCHEMA public"))

    with engine.begin() as conexao:
        conexao.execute(
            text(
                "CREATE TABLE snapshots ("
                "id SERIAL PRIMARY KEY, tipo_arquivo VARCHAR(10) NOT NULL, "
                "nome_arquivo_original VARCHAR(255) NOT NULL, caminho_arquivo_bruto VARCHAR(500) NOT NULL, "
                "data_snapshot TIMESTAMP NOT NULL, data_upload TIMESTAMP NOT NULL)"
            )
        )
        conexao.execute(
            text(
                "CREATE TABLE entidades ("
                "id SERIAL PRIMARY KEY, nome_normalizado VARCHAR(255) NOT NULL, "
                "nome_original VARCHAR(255) NOT NULL, cpf_cnpj VARCHAR(20), tipo_pessoa VARCHAR(20), "
                "categoria VARCHAR(50), subregiao VARCHAR(100), situacao_registro VARCHAR(50))"
            )
        )
        conexao.execute(
            text(
                "CREATE UNIQUE INDEX ix_entidades_nome_normalizado ON entidades (nome_normalizado)"
            )
        )
        conexao.execute(
            text(
                "CREATE TABLE debitos ("
                "id SERIAL PRIMARY KEY, snapshot_id INTEGER NOT NULL REFERENCES snapshots(id), "
                "entidade_id INTEGER NOT NULL REFERENCES entidades(id), origem VARCHAR(10) NOT NULL, "
                "ano_referencia INTEGER NOT NULL, tipo_debito VARCHAR(50) NOT NULL, numero_parcela INTEGER, "
                "data_vencimento DATE, valor_original NUMERIC(12, 2), valor_devido NUMERIC(12, 2), "
                "valor_total NUMERIC(12, 2), situacao_pagamento VARCHAR(50), situacao_divida_ativa VARCHAR(50), "
                "situacao_parcelamento VARCHAR(50))"
            )
        )
        conexao.execute(
            text(
                "INSERT INTO snapshots "
                "(id, tipo_arquivo, nome_arquivo_original, caminho_arquivo_bruto, data_snapshot, data_upload) "
                "VALUES (1, 'xlsx', 'legado.xlsx', '/tmp/legado.xlsx', '2026-09-14', '2026-09-14')"
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
                "INSERT INTO debitos (id, snapshot_id, entidade_id, origem, ano_referencia, tipo_debito) "
                "VALUES (1, 1, 1, 'xlsx', 2024, 'ANUIDADE')"
            )
        )

    with engine.connect() as conexao:
        assert not sa_inspect(conexao).has_table("alembic_version")

    config = Config(str(Path(__file__).parents[1] / "alembic.ini"))
    command.upgrade(config, "head")

    with engine.connect() as conexao:
        assert conexao.scalar(text("SELECT version_num FROM alembic_version")) == "0002_historical_observations"
        assert conexao.scalar(text("SELECT count(*) FROM snapshots")) == 1
        assert conexao.scalar(text("SELECT count(*) FROM debitos")) == 1
        assert conexao.scalar(text("SELECT count(*) FROM observacoes_entidades")) == 1
        assert conexao.scalar(text("SELECT count(*) FROM entidades")) == 1
        observacao = conexao.execute(
            text("SELECT entidade_id, cpf_cnpj FROM observacoes_entidades")
        ).one()
        assert observacao.entidade_id is not None
        assert observacao.cpf_cnpj == "123.456.789-01"
