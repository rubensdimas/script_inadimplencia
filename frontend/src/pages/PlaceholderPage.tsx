import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface PlaceholderPageProps {
  titulo: string;
  descricao: string;
}

/** Tela ainda nao implementada (proxima etapa do plano de conclusao). */
export function PlaceholderPage({ titulo, descricao }: PlaceholderPageProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{titulo}</CardTitle>
        <CardDescription>{descricao}</CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">Em construção.</CardContent>
    </Card>
  );
}
