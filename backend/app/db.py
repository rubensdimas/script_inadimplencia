import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

engine = create_engine(os.environ["DATABASE_URL"])
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_sessao():
    sessao = SessionLocal()
    try:
        yield sessao
    finally:
        sessao.close()
