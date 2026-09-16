import re

from app.errors import ErroIngestao


def normalizar_documento(documento: str | None) -> str | None:
    if documento is None or not documento.strip():
        return None
    normalizado = re.sub(r"\D", "", documento)
    if len(normalizado) not in (11, 14):
        raise ErroIngestao("CPF/CNPJ deve conter 11 ou 14 digitos")
    return normalizado


def mascarar_documento(documento: str | None) -> str | None:
    if documento is None:
        return None
    normalizado = re.sub(r"\D", "", documento)
    if len(normalizado) == 11:
        return f"***.***.***-{normalizado[-2:]}"
    if len(normalizado) == 14:
        return f"**.***.***/****-{normalizado[-2:]}"
    return f"***{normalizado[-2:]}" if normalizado else None
