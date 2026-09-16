from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class SnapshotOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    tipo_arquivo: str
    nome_arquivo_original: str
    data_snapshot: datetime
    data_upload: datetime


class EntidadeResumoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int | None = Field(validation_alias="entidade_id")
    observacao_id: int
    nome_normalizado: str
    nome_original: str
    cpf_cnpj: str | None = Field(validation_alias="cpf_cnpj_mascarado")
    tipo_pessoa: str | None
    registro_resumido: str | None
    categoria: str | None
    subregiao: str | None
    situacao_registro: str | None


class DebitoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    origem: str
    ano_referencia: int
    tipo_debito: str
    numero_parcela: int | None
    data_vencimento: date | None
    valor_original: float | None
    valor_devido: float | None
    valor_total: float | None
    situacao_pagamento: str | None
    situacao_divida_ativa: str | None
    situacao_parcelamento: str | None
    entidade: EntidadeResumoOut = Field(validation_alias="observacao")


class PaginaDebitosOut(BaseModel):
    items: list[DebitoOut]
    total: int
    page: int
    page_size: int
    pages: int
