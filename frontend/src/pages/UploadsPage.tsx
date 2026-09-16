import { UploadCard } from "../components/UploadCard";
import { enviarCsv, enviarXlsx } from "../api/uploads";

export function UploadsPage() {
  return (
    <div>
      <div className="pagina-cabecalho">
        <h2>Uploads</h2>
        <p>Envie o CSV de débitos e a planilha XLSX de cadastro/financeiro de forma independente.</p>
      </div>
      <div className="grade-uploads">
        <UploadCard
          titulo="Débitos (CSV)"
          descricao="Arquivo CSV exportado do sistema de débitos/parcelas."
          accept=".csv,text/csv"
          onUpload={enviarCsv}
        />
        <UploadCard
          titulo="Cadastro e financeiro (XLSX)"
          descricao="Planilha XLSX com os blocos de cadastro e débito por ano."
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          onUpload={enviarXlsx}
        />
      </div>
    </div>
  );
}
