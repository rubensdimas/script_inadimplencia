import unicodedata


def normalize_nome(bruto: str) -> str:
    hifens_uniformes = "".join("-" if unicodedata.category(caractere) == "Pd" else caractere for caractere in bruto)
    sem_acento = unicodedata.normalize("NFKD", hifens_uniformes).encode("ascii", "ignore").decode("ascii")
    return " ".join(sem_acento.upper().split())
