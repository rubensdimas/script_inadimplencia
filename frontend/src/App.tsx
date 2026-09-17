import { Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "@/components/layout/AppShell";
import { PlaceholderPage } from "@/pages/PlaceholderPage";
import { UploadsPage } from "@/pages/uploads/UploadsPage";

function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route
          index
          element={
            <PlaceholderPage
              titulo="Dashboard"
              descricao="Indicadores, rankings, dívida ativa, distribuições e evolução histórica."
            />
          }
        />
        <Route path="uploads" element={<UploadsPage />} />
        <Route
          path="entidades"
          element={
            <PlaceholderPage titulo="Entidades" descricao="Busca, filtros, paginação e histórico por profissional/empresa." />
          }
        />
        <Route
          path="pendencias"
          element={
            <PlaceholderPage
              titulo="Pendências de pareamento"
              descricao="Nomes que não bateram exatamente entre CSV e XLSX no par de snapshots selecionado."
            />
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
