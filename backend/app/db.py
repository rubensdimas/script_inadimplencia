import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models import Base

engine = create_engine(os.environ["DATABASE_URL"])
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def criar_tabelas() -> None:
    Base.metadata.create_all(bind=engine)


def get_sessao():
    sessao = SessionLocal()
    try:
        yield sessao
    finally:
        sessao.close()
