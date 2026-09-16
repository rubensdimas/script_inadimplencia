import { NavLink } from "react-router-dom";
import { LayoutDashboard, UploadCloud, Users, AlertTriangle } from "lucide-react";

const ITENS_NAVEGACAO = [
  { caminho: "/", rotulo: "Dashboard", Icone: LayoutDashboard, fim: true },
  { caminho: "/uploads", rotulo: "Uploads", Icone: UploadCloud, fim: false },
  { caminho: "/entidades", rotulo: "Entidades", Icone: Users, fim: false },
  { caminho: "/pendencias", rotulo: "Pendências", Icone: AlertTriangle, fim: false },
] as const;

export function Nav() {
  return (
    <nav className="app-nav" aria-label="Navegação principal">
      {ITENS_NAVEGACAO.map(({ caminho, rotulo, Icone, fim }) => (
        <NavLink
          key={caminho}
          to={caminho}
          end={fim}
          className={({ isActive }) => (isActive ? "ativo" : undefined)}
        >
          <Icone size={18} aria-hidden="true" />
          {rotulo}
        </NavLink>
      ))}
    </nav>
  );
}
