import pytest

from app.documentos import normalizar_documento
from app.errors import ErroIngestao


def test_normalizar_documento_trata_documento_zerado_como_sem_documento():
    assert normalizar_documento("0") is None


def test_normalizar_documento_trata_documento_zerado_com_pontuacao_como_sem_documento():
    assert normalizar_documento("00.000.000/0000-00") is None


def test_normalizar_documento_ainda_rejeita_tamanho_invalido_nao_zerado():
    with pytest.raises(ErroIngestao, match="11 ou 14"):
        normalizar_documento("123")
