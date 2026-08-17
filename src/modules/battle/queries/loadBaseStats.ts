import { prisma } from "@/src/lib/prisma";
import type { BaseStats } from "@/src/modules/pokemon";

/**
 * Base stats das espécies pedidas, lidos do espelho (`Pokemon`).
 *
 * Existe pra a carta de reserva poder desenhar os 6 atributos. Vem daqui e não
 * do snapshot por dois motivos: o snapshot guarda o stat DERIVADO (já com o
 * nível dentro), e a carta precisa do BASE — é ele que dá a proporção da barra
 * ("esse é tanque, aquele é rápido"). E base stat é fato IMUTÁVEL da espécie,
 * então ler ao vivo não briga com o congelamento da partida: com o nível
 * congelado do snapshot, o número derivado bate com o do motor.
 *
 * Quem decide DE QUEM carregar é quem chama — e só carrega do próprio time (ver
 * toBattleDTO: stat do oponente não sai no DTO).
 */
export async function loadBaseStats(pokemonApiIds: Iterable<number>): Promise<Map<number, BaseStats>> {
  const ids = Array.from(new Set(pokemonApiIds));
  if (ids.length === 0) return new Map();

  const rows = await prisma.pokemon.findMany({
    where: { pokemonApiId: { in: ids } },
    select: { pokemonApiId: true, baseStats: true },
  });

  // Espécie fora do espelho (ambiente sem seed) simplesmente não entra no mapa:
  // a carta cai no desenho sem barras, em vez de a leitura inteira falhar.
  return new Map(rows.map((r) => [r.pokemonApiId, r.baseStats as unknown as BaseStats]));
}
