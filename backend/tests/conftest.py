import pytest
from fastapi.testclient import TestClient

from app.db import engine
from app.main import app
from app.models import Base


@pytest.fixture()
def cliente():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with TestClient(app) as cliente:
        yield cliente
