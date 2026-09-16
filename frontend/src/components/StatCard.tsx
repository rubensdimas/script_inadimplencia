interface StatCardProps {
  rotulo: string;
  valor: string;
}

export function StatCard({ rotulo, valor }: StatCardProps) {
  return (
    <div className="cartao cartao-indicador">
      <span className="cartao-rotulo">{rotulo}</span>
      <span className="cartao-valor">{valor}</span>
    </div>
  );
}
