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
            total = reprocessar_todos_snapshots(sessao)
        print(f"{total} snapshot(s) reprocessado(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
