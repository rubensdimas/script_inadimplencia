import { cn } from "@/lib/utils";

interface CamposCadastraisProps {
  tipoPessoa?: string | null;
  categoria?: string | null;
  registro?: string | null;
  subregiao?: string | null;
  className?: string;
}

/**
 * Campos cadastrais como pares rotulados, nao como texto "A · B · C" —
 * estrutura real (cada fragmento diz o que e), nao decoracao.
 */
export function CamposCadastrais({ tipoPessoa, categoria, registro, subregiao, className }: CamposCadastraisProps) {
  const campos: { rotulo: string; valor: string }[] = [
    ...(tipoPessoa ? [{ rotulo: "Tipo", valor: tipoPessoa }] : []),
    ...(categoria ? [{ rotulo: "Categoria", valor: categoria }] : []),
    ...(registro ? [{ rotulo: "Registro", valor: registro }] : []),
    ...(subregiao && subregiao !== "Não informado" ? [{ rotulo: "Subregião", valor: subregiao }] : []),
  ];

  if (campos.length === 0) {
    return <p className={cn("text-sm text-muted-foreground", className)}>Sem dados cadastrais adicionais.</p>;
  }

  return (
    <div className={cn("flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-muted-foreground", className)}>
      {campos.map((campo) => (
        <span key={campo.rotulo}>
          <span className="text-foreground">{campo.rotulo}:</span> {campo.valor}
        </span>
      ))}
    </div>
  );
}
