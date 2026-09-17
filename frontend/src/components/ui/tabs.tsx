import * as React from "react";

import { cn } from "@/lib/utils";

interface TabsContextValue {
  valorAtivo: string;
  selecionar: (valor: string) => void;
}

const TabsContext = React.createContext<TabsContextValue | null>(null);

function useTabsContext(componente: string): TabsContextValue {
  const contexto = React.useContext(TabsContext);
  if (!contexto) throw new Error(`${componente} precisa estar dentro de <Tabs>`);
  return contexto;
}

interface TabsProps {
  value: string;
  onValueChange: (valor: string) => void;
  className?: string;
  children: React.ReactNode;
}

export function Tabs({ value, onValueChange, className, children }: TabsProps) {
  return (
    <TabsContext.Provider value={{ valorAtivo: value, selecionar: onValueChange }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div role="tablist" className={cn("flex flex-wrap gap-1 border-b border-border", className)}>
      {children}
    </div>
  );
}

interface TabsTriggerProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

export function TabsTrigger({ value, children, className }: TabsTriggerProps) {
  const { valorAtivo, selecionar } = useTabsContext("TabsTrigger");
  const ativo = valorAtivo === value;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={ativo}
      id={`tab-${value}`}
      aria-controls={`painel-${value}`}
      onClick={() => selecionar(value)}
      className={cn(
        "flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
        ativo
          ? "border-primary text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}

interface TabsContentProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

export function TabsContent({ value, children, className }: TabsContentProps) {
  const { valorAtivo } = useTabsContext("TabsContent");
  if (valorAtivo !== value) return null;
  return (
    <div role="tabpanel" id={`painel-${value}`} aria-labelledby={`tab-${value}`} className={className}>
      {children}
    </div>
  );
}
