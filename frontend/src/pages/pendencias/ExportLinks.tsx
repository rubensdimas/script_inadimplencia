import { Download } from "lucide-react";

import { urlExportacao } from "@/api/client";

interface ExportLinksProps {
  csvSnapshotId: number;
  xlsxSnapshotId: number;
}

/** Link direto: a resposta ja vem com Content-Disposition:attachment. */
export function ExportLinks({ csvSnapshotId, xlsxSnapshotId }: ExportLinksProps) {
  const parametros = { csvSnapshotId, xlsxSnapshotId };
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-muted-foreground">Exportar:</span>
      <a
        href={urlExportacao("matching-issues", "csv", parametros)}
        className="flex items-center gap-1 font-medium text-primary hover:underline"
      >
        <Download className="h-3.5 w-3.5" aria-hidden />
        CSV
      </a>
      <a
        href={urlExportacao("matching-issues", "xlsx", parametros)}
        className="flex items-center gap-1 font-medium text-primary hover:underline"
      >
        <Download className="h-3.5 w-3.5" aria-hidden />
        Excel
      </a>
    </div>
  );
}
