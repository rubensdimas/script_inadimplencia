import { useId } from "react";
import type { SnapshotOut } from "../api/types";
import { formatarData } from "../utils/format";

interface SnapshotSelectProps {
  rotulo: string;
  snapshots: SnapshotOut[];
  valor: number | undefined;
  aoAlterar: (id: number | undefined) => void;
  desabilitado?: boolean;
}

export function SnapshotSelect({ rotulo, snapshots, valor, aoAlterar, desabilitado }: SnapshotSelectProps) {
  const idCampo = useId();

  return (
    <div className="campo-selecionador">
      <label htmlFor={idCampo}>{rotulo}</label>
      <select
        id={idCampo}
        value={valor ?? ""}
        disabled={desabilitado}
        onChange={(evento) => {
          const bruto = evento.target.value;
          aoAlterar(bruto === "" ? undefined : Number(bruto));
        }}
      >
        <option value="">Mais recente</option>
        {snapshots.map((snapshot) => (
          <option key={snapshot.id} value={snapshot.id}>
            {snapshot.nome_arquivo_original} — {formatarData(snapshot.data_snapshot)}
          </option>
        ))}
      </select>
    </div>
  );
}
