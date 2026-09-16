import re
from datetime import datetime

_PADRAO_TIMESTAMP = re.compile(r"(\d{8}_\d{6})")


def extrair_data_snapshot(nome_arquivo: str, data_upload: datetime) -> datetime:
    correspondencia = _PADRAO_TIMESTAMP.search(nome_arquivo)
    if not correspondencia:
        return data_upload
    return datetime.strptime(correspondencia.group(1), "%Y%m%d_%H%M%S")
