import { prisma } from "@/src/lib/prisma";
import { LOSER_XP_SHARE, xpFromDefeat, type XpAward } from "@/src/modules/pokemon";

// Quanto vale a vitória: traduz o fim da partida no XP que cada lado leva.
//
// A fórmula é a da série (gen 5+): baseExperience do DERROTADO × nível dele / 7
// (ver pokemon/domain/leveling.ts). O único desvio consciente é o perdedor
// levar LOSER_XP_SHARE do que levaria — sem isso, quem perde nunca destrava
// nada e entra numa espiral.
//
// Isto aqui só CALCULA, e só LÊ. Quem ESCREVE no UserPokemon (reescrever o par
// xp/level, evoluir) é o `grantXp` do módulo pokemon: nível e evolução são do
// pokémon, não da partida. A divisão também separa o que roda onde — esta
// metade roda FORA da transação (antes do claim), a outra roda DENTRO dela.

/** O snapshot de um combatente, do jeito que a linha do banco entrega. */
interface CombatantRow {
  userPokemonId: string | null;
  pokemonId: number; // pokemonApiId da espécie
  level: number;
}

export interface XpContext {
  winner: XpAward;
  loser: XpAward | null;
}

/**
 * Monta o crédito dos dois lados. SÓ LÊ (o `baseExperience` das espécies vem do
 * espelho) — por isso é chamada FORA da transação, antes do claim.
 *
 * Devolve null quando não há a quem pagar: snapshot antigo sem `userPokemonId`
 * (partida criada antes desta fatia) ou espécie fora do espelho.
 */
export async function loadXpContext(
  winner: CombatantRow,
  loser: CombatantRow
): Promise<XpContext | null> {
  if (!winner.userPokemonId) return null;

  const species = await prisma.pokemon.findMany({
    where: { pokemonApiId: { in: [winner.pokemonId, loser.pokemonId] } },
    select: { pokemonApiId: true, baseExperience: true },
  });
  const baseExpOf = (apiId: number) =>
    species.find((s) => s.pokemonApiId === apiId)?.baseExperience ?? null;

  const winnerXp = xpFromDefeat(baseExpOf(loser.pokemonId), loser.level);
  const loserXp = Math.floor(xpFromDefeat(baseExpOf(winner.pokemonId), winner.level) * LOSER_XP_SHARE);

  return {
    winner: { userPokemonId: winner.userPokemonId, gainedXp: winnerXp },
    loser: loser.userPokemonId ? { userPokemonId: loser.userPokemonId, gainedXp: loserXp } : null,
  };
}

/** Os dois créditos achatados, do jeito que o `grantXp` recebe. */
export function xpAwardsOf(context: XpContext): XpAward[] {
  return [context.winner, context.loser].filter((a): a is XpAward => a !== null);
}
