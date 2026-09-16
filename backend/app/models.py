from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Snapshot(Base):
    __tablename__ = "snapshots"

    id: Mapped[int] = mapped_column(primary_key=True)
    tipo_arquivo: Mapped[str] = mapped_column(String(10))
    nome_arquivo_original: Mapped[str] = mapped_column(String(255))
    caminho_arquivo_bruto: Mapped[str] = mapped_column(String(500))
    data_snapshot: Mapped[datetime] = mapped_column(DateTime)
    data_upload: Mapped[datetime] = mapped_column(DateTime)

    debitos: Mapped[list["Debito"]] = relationship(back_populates="snapshot")


class Entidade(Base):
    __tablename__ = "entidades"

    id: Mapped[int] = mapped_column(primary_key=True)
    nome_normalizado: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    nome_original: Mapped[str] = mapped_column(String(255))
    cpf_cnpj: Mapped[str | None] = mapped_column(String(20), nullable=True)
    tipo_pessoa: Mapped[str | None] = mapped_column(String(20), nullable=True)
    categoria: Mapped[str | None] = mapped_column(String(50), nullable=True)
    subregiao: Mapped[str | None] = mapped_column(String(100), nullable=True)
    situacao_registro: Mapped[str | None] = mapped_column(String(50), nullable=True)

    debitos: Mapped[list["Debito"]] = relationship(back_populates="entidade")


class Debito(Base):
    __tablename__ = "debitos"

    id: Mapped[int] = mapped_column(primary_key=True)
    snapshot_id: Mapped[int] = mapped_column(ForeignKey("snapshots.id"))
    entidade_id: Mapped[int] = mapped_column(ForeignKey("entidades.id"))
    origem: Mapped[str] = mapped_column(String(10))
    ano_referencia: Mapped[int] = mapped_column(Integer)
    tipo_debito: Mapped[str] = mapped_column(String(50))
    numero_parcela: Mapped[int | None] = mapped_column(Integer, nullable=True)
    data_vencimento: Mapped[date | None] = mapped_column(Date, nullable=True)
    valor_original: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    valor_devido: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    valor_total: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    situacao_pagamento: Mapped[str | None] = mapped_column(String(50), nullable=True)
    situacao_divida_ativa: Mapped[str | None] = mapped_column(String(50), nullable=True)
    situacao_parcelamento: Mapped[str | None] = mapped_column(String(50), nullable=True)

    snapshot: Mapped["Snapshot"] = relationship(back_populates="debitos")
    entidade: Mapped["Entidade"] = relationship(back_populates="debitos")
