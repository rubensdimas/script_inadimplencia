from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

from app.documentos import mascarar_documento


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

    observacoes: Mapped[list["ObservacaoEntidade"]] = relationship(
        back_populates="snapshot", cascade="all, delete-orphan"
    )


class Entidade(Base):
    __tablename__ = "entidades"

    id: Mapped[int] = mapped_column(primary_key=True)
    documento_normalizado: Mapped[str] = mapped_column(String(14), unique=True, index=True)
    tipo_pessoa: Mapped[str | None] = mapped_column(String(20), nullable=True)

    observacoes: Mapped[list["ObservacaoEntidade"]] = relationship(back_populates="entidade")


class ObservacaoEntidade(Base):
    __tablename__ = "observacoes_entidades"

    id: Mapped[int] = mapped_column(primary_key=True)
    snapshot_id: Mapped[int] = mapped_column(ForeignKey("snapshots.id", ondelete="CASCADE"), index=True)
    entidade_id: Mapped[int | None] = mapped_column(
        ForeignKey("entidades.id", ondelete="SET NULL"), nullable=True, index=True
    )
    nome_original: Mapped[str] = mapped_column(String(255))
    nome_normalizado: Mapped[str] = mapped_column(String(255), index=True)
    cpf_cnpj: Mapped[str | None] = mapped_column(String(20), nullable=True)
    tipo_pessoa: Mapped[str | None] = mapped_column(String(20), nullable=True)
    registro_resumido: Mapped[str | None] = mapped_column(String(255), nullable=True)
    categoria: Mapped[str | None] = mapped_column(String(50), nullable=True)
    subregiao: Mapped[str | None] = mapped_column(String(100), nullable=True)
    situacao_registro: Mapped[str | None] = mapped_column(String(50), nullable=True)

    snapshot: Mapped[Snapshot] = relationship(back_populates="observacoes")
    entidade: Mapped[Entidade | None] = relationship(back_populates="observacoes")
    debitos: Mapped[list["Debito"]] = relationship(
        back_populates="observacao", cascade="all, delete-orphan"
    )

    @property
    def observacao_id(self) -> int:
        return self.id

    @property
    def cpf_cnpj_mascarado(self) -> str | None:
        return mascarar_documento(self.cpf_cnpj)


class Debito(Base):
    __tablename__ = "debitos"

    id: Mapped[int] = mapped_column(primary_key=True)
    observacao_id: Mapped[int] = mapped_column(
        ForeignKey("observacoes_entidades.id", ondelete="CASCADE"), index=True
    )
    origem: Mapped[str] = mapped_column(String(10))
    ano_referencia: Mapped[int] = mapped_column(Integer)
    tipo_debito: Mapped[str] = mapped_column(String(50))
    numero_parcela: Mapped[int | None] = mapped_column(Integer, nullable=True)
    data_vencimento: Mapped[date | None] = mapped_column(Date, nullable=True)
    valor_original: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    valor_devido: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    valor_total: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    situacao_pagamento: Mapped[str | None] = mapped_column(String(50), nullable=True)
    situacao_divida_ativa: Mapped[str | None] = mapped_column(String(50), nullable=True)
    situacao_parcelamento: Mapped[str | None] = mapped_column(String(50), nullable=True)

    observacao: Mapped[ObservacaoEntidade] = relationship(back_populates="debitos")
