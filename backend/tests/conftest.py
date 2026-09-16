from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.engine import make_url

from app.db import engine
from app.main import app


@pytest.fixture(scope="session", autouse=True)
def banco_de_testes_migrado():
    nome_banco = make_url(str(engine.url)).database or ""
    if not nome_banco.endswith("_test"):
        raise RuntimeError("a suite requer um DATABASE_URL dedicado terminado em _test")

    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conexao:
        conexao.execute(text("DROP SCHEMA public CASCADE"))
        conexao.execute(text("CREATE SCHEMA public"))

    config = Config(str(Path(__file__).parents[1] / "alembic.ini"))
    command.upgrade(config, "head")
    yield


@pytest.fixture()
def cliente():
    with engine.begin() as conexao:
        conexao.execute(
            text(
                "TRUNCATE TABLE debitos, observacoes_entidades, entidades, snapshots "
                "RESTART IDENTITY CASCADE"
            )
        )
    with TestClient(app) as cliente_teste:
        yield cliente_teste
