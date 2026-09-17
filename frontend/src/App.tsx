import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "@/components/layout/AppShell";
import { PendenciasPage } from "@/pages/pendencias/PendenciasPage";
import { PlaceholderPage } from "@/pages/PlaceholderPage";
import { UploadsPage } from "@/pages/uploads/UploadsPage";

// Recharts sozinho responde pela maior parte do bundle; so a tela de
// Dashboard usa grafico, entao ela e a unica carregada sob demanda.
const DashboardPage = lazy(() =>
  import("@/pages/dashboard/DashboardPage").then((modulo) => ({ default: modulo.DashboardPage })),
);

function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route
          index
          element={
            <Suspense fallback={<p className="text-sm text-muted-foreground">Carregando…</p>}>
              <DashboardPage />
            </Suspense>
          }
        />
        <Route path="uploads" element={<UploadsPage />} />
        <Route
          path="entidades"
          element={
            <PlaceholderPage titulo="Entidades" descricao="Busca, filtros, paginação e histórico por profissional/empresa." />
          }
        />
        <Route path="pendencias" element={<PendenciasPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
