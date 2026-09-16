import unicodedata


def normalize_nome(bruto: str) -> str:
    sem_acento = unicodedata.normalize("NFKD", bruto).encode("ascii", "ignore").decode("ascii")
    return " ".join(sem_acento.upper().split())
