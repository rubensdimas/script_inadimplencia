import type { NomeAmbiguo } from "@/api/client";
import { Badge } from "@/components/ui/badge";
import { ehSituacaoDeAtencao } from "@/lib/situacao-registro";

interface NomeAmbiguoGroupProps {
  grupo: NomeAmbiguo;
}

/**
 * Um nome do CSV que bate com mais de um cadastro do XLSX: nao da para
 * decidir automaticamente qual e (por isso "ambiguo", nunca resolvido por
 * fuzzy matching). Os candidatos tem o mesmo nome por definicao — a tabela
 * existe para comparar o que os diferencia, nao para repetir o nome.
 */
export function NomeAmbiguoGroup({ grupo }: NomeAmbiguoGroupProps) {
  return (
    <li className="px-6 py-4">
      <p className="text-sm font-semibold text-foreground">{grupo.nome_normalizado}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Bate com {grupo.candidatos_xlsx.length} cadastros diferentes no XLSX — confira qual antes de tratar como o
        mesmo profissional ou empresa.
      </p>
      {/* overflow-x-auto proprio da tabela: em telas estreitas ela rola dentro
          da propria caixa em vez de estourar a largura da pagina — mantem as
          colunas alinhadas (o ponto da comparacao) em vez de empilhar. */}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th scope="col" className="py-1.5 pr-3 font-normal">
                Tipo
              </th>
              <th scope="col" className="py-1.5 pr-3 font-normal">
                Categoria
              </th>
              <th scope="col" className="py-1.5 pr-3 font-normal">
                Registro
              </th>
              <th scope="col" className="py-1.5 pr-3 font-normal">
                Situação
              </th>
              <th scope="col" className="py-1.5 font-normal">
                Documento
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {grupo.candidatos_xlsx.map((candidato) => (
              <tr key={candidato.observacao_id}>
                <td className="py-1.5 pr-3 text-foreground">{candidato.tipo_pessoa ?? "—"}</td>
                <td className="py-1.5 pr-3 text-foreground">{candidato.categoria ?? "—"}</td>
                <td className="py-1.5 pr-3 text-foreground">{candidato.registro_resumido ?? "—"}</td>
                <td className="py-1.5 pr-3">
                  {candidato.situacao_registro ? (
                    <Badge variant={ehSituacaoDeAtencao(candidato.situacao_registro) ? "warning" : "neutral"}>
                      {candidato.situacao_registro}
                    </Badge>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="py-1.5 font-mono text-xs text-muted-foreground">{candidato.cpf_cnpj ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </li>
  );
}
