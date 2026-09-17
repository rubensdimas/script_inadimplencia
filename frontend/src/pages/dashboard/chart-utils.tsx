import type { ReactNode } from "react";

/**
 * Cor categorica fixa por tipo de debito (identidade, nao ranking) - os 5
 * slots validados para seguranca de daltonismo pelo skill de dataviz, na
 * ordem fixa documentada em docs/DESIGN.md. Um tipo fora da lista conhecida
 * (nova regra do CREFITO11) cai em cinza neutro em vez de inventar uma cor
 * nao validada.
 */
const ORDEM_TIPOS_DEBITO: Record<string, string> = {
  ANUIDADE: "hsl(var(--cat-1))",
  "ANUIDADE PROPORCIONAL": "hsl(var(--cat-2))",
  "ANUIDADE COMPLEMENTAR": "hsl(var(--cat-3))",
  "MULTA ELEITORAL": "hsl(var(--cat-4))",
  "MULTA ETICA": "hsl(var(--cat-5))",
};

function normalizar(texto: string): string {
  return texto
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function corTipoDebito(tipo: string): string {
  return ORDEM_TIPOS_DEBITO[normalizar(tipo)] ?? "hsl(var(--muted-foreground))";
}

export const CHART_TOKENS = {
  grid: "hsl(var(--border))",
  axis: "hsl(var(--muted-foreground))",
  brand: "hsl(var(--primary))",
};

interface ChartTooltipProps {
  active?: boolean;
  label?: string | number;
  children?: ReactNode;
}

/** Caixa de tooltip no vocabulario visual do app (nunca o balao branco padrao do Recharts). */
export function ChartTooltip({ active, label, children }: ChartTooltipProps) {
  if (!active) return null;
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 text-xs shadow-none">
      {label !== undefined ? <p className="mb-1 font-medium text-foreground">{label}</p> : null}
      {children}
    </div>
  );
}
