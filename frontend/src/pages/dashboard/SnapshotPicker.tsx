import type { Snapshot } from "@/api/client";
import { Select } from "@/components/ui/select";
import { formatarData } from "@/lib/format";

interface SnapshotPickerProps {
  label: string;
  snapshots?: Snapshot[];
  valorSelecionado?: number;
  onSelecionar: (id: number) => void;
}

export function SnapshotPicker({ label, snapshots, valorSelecionado, onSelecionar }: SnapshotPickerProps) {
  const carregando = snapshots === undefined;
  const semSnapshots = snapshots?.length === 0;

  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <Select
        className="min-w-56"
        value={valorSelecionado ?? ""}
        disabled={carregando || semSnapshots}
        onChange={(evento) => onSelecionar(Number(evento.target.value))}
      >
        {carregando ? <option value="">Carregando…</option> : null}
        {semSnapshots ? <option value="">Nenhum snapshot enviado</option> : null}
        {snapshots?.map((snapshot) => (
          <option key={snapshot.id} value={snapshot.id}>
            {formatarData(snapshot.data_snapshot)} ({snapshot.nome_arquivo_original})
          </option>
        ))}
      </Select>
    </label>
  );
}
