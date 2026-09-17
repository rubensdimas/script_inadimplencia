import * as React from "react";
import { AlertCircle, AlertOctagon, AlertTriangle, CheckCircle2 } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Severidade sempre com icone + rotulo, nunca so a cor (cores de status sao
 * as mesmas validadas para daltonismo pelo skill de dataviz; ver
 * docs/DESIGN.md). "neutral" nao carrega severidade, so identificacao.
 */
// Texto sempre em `foreground` (nunca na cor do status - ver marks-and-anatomy
// do skill de dataviz): a cor entra pelo fundo tingido, borda e icone.
const VARIANTES = {
  critical: { className: "border-destructive/40 bg-destructive/10 text-foreground", Icon: AlertOctagon },
  serious: { className: "border-serious/50 bg-serious/15 text-foreground", Icon: AlertTriangle },
  warning: { className: "border-warning/50 bg-warning/15 text-foreground", Icon: AlertCircle },
  success: { className: "border-success/40 bg-success/10 text-foreground", Icon: CheckCircle2 },
  neutral: { className: "border-border bg-muted text-muted-foreground", Icon: undefined },
} as const;

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: keyof typeof VARIANTES;
}

export function Badge({ variant = "neutral", className, children, ...props }: BadgeProps) {
  const { className: variantClassName, Icon } = VARIANTES[variant];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        variantClassName,
        className,
      )}
      {...props}
    >
      {Icon ? <Icon className="h-3 w-3" aria-hidden /> : null}
      {children}
    </span>
  );
}
