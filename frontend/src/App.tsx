import { Route, Routes } from "react-router-dom";
import { Nav } from "./components/Nav";
import { DashboardPage } from "./pages/DashboardPage";
import { UploadsPage } from "./pages/UploadsPage";
import { EntidadesPage } from "./pages/EntidadesPage";
import { EntidadeDetalhePage } from "./pages/EntidadeDetalhePage";
import { PendenciasPage } from "./pages/PendenciasPage";

function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Inadimplência CREFITO11</h1>
      </header>
      <Nav />
      <main className="app-content">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/uploads" element={<UploadsPage />} />
          <Route path="/entidades" element={<EntidadesPage />} />
          <Route path="/entidades/:id" element={<EntidadeDetalhePage />} />
          <Route path="/pendencias" element={<PendenciasPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
