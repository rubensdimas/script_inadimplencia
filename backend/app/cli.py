import argparse

from app.db import SessionLocal
from app.services.ingestion import reprocessar_todos_snapshots


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    subcomandos = parser.add_subparsers(dest="comando", required=True)
    subcomandos.add_parser("reprocessar-snapshots")
    argumentos = parser.parse_args(argv)

    if argumentos.comando == "reprocessar-snapshots":
        with SessionLocal() as sessao:
            resultado = reprocessar_todos_snapshots(sessao)
        print(f"{len(resultado.sucesso)} snapshot(s) reprocessado(s)")
        for snapshot_id, erro in resultado.falhas.items():
            print(f"snapshot {snapshot_id} falhou: {erro}")
        return 1 if resultado.falhas else 0
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
