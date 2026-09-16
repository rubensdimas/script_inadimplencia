import { montarUrlExportacao, type DatasetExportacao } from "../api/exports";

interface ExportButtonsProps {
  dataset: DatasetExportacao;
  parametros: Record<string, string | number | undefined>;
  rotulo?: string;
}

export function ExportButtons({ dataset, parametros, rotulo = "Exportar" }: ExportButtonsProps) {
  return (
    <div className="acoes-exportacao" role="group" aria-label={rotulo}>
      <span className="acoes-exportacao-rotulo">{rotulo}</span>
      <a className="botao-exportar" href={montarUrlExportacao(dataset, "csv", parametros)} download>
        CSV
      </a>
      <a className="botao-exportar" href={montarUrlExportacao(dataset, "xlsx", parametros)} download>
        XLSX
      </a>
    </div>
  );
}
