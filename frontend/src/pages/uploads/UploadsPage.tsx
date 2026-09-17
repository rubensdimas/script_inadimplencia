import { uploadCsv, uploadXlsx } from "@/api/client";

import { UploadCard } from "./UploadCard";

export function UploadsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif text-2xl font-bold tracking-tight">Uploads</h1>
        <p className="text-sm text-muted-foreground">
          Envie os relatórios de inadimplência. Cada fonte é importada de forma independente e vira um
          novo snapshot histórico.
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <UploadCard
          tipoArquivo="csv"
          titulo="CSV analítico"
          descricao="Relatório simples por débito (nome, tipo, ano, parcela, vencimento e status)."
          accept=".csv,text/csv"
          enviar={uploadCsv}
        />
        <UploadCard
          tipoArquivo="xlsx"
          titulo="XLSX de débitos"
          descricao="Relatório detalhado por profissional/empresa, com dados cadastrais e até 37 débitos."
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          enviar={uploadXlsx}
        />
      </div>
    </div>
  );
}
