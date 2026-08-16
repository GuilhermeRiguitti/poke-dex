import { prisma } from "@/src/lib/prisma";
import type { TypeEffectivenessMap } from "../domain/typeChart";

// A matriz de efetividade, lida do ESPELHO (tabela `Type`, escrita pelo
// syncTypes). UMA consulta, zero rede — a partida não tem caminho pra PokéAPI.
//
// Mora em `queries/` porque agora tem DOIS consumidores com propósitos
// diferentes: a resolução do turno (que calcula o dano) e o DTO (que só quer
// dizer pro jogador se o golpe é super eficaz antes de ele gastar o turno).
// Duplicar a leitura em cada um seria duas verdades sobre a mesma tabela.
//
// Linha faltando (ambiente sem seed) = tipo sem multiplicador, e o
// `effectivenessMultiplier` cai em 1x. Melhor um dano neutro que uma partida
// que não resolve — mas o seed é quem evita isso, não a sorte.
export async function loadTypeChart(typeNames: Iterable<string>): Promise<TypeEffectivenessMap> {
  const names = Array.from(new Set(typeNames));
  if (names.length === 0) return {};

  const rows = await prisma.type.findMany({ where: { name: { in: names } } });

  const chart: TypeEffectivenessMap = {};
  for (const type of rows) {
    const row: Record<string, number> = {};
    for (const t of type.doubleDamageTo as string[]) row[t] = 2;
    for (const t of type.halfDamageTo as string[]) row[t] = 0.5;
    for (const t of type.noDamageTo as string[]) row[t] = 0;
    chart[type.name] = row;
  }

  return chart;
}
