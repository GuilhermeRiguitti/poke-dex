import type { Prisma } from "@prisma/client";
import { prisma } from "@/src/lib/prisma";
import {
  applyXp,
  evolutionTargetFor,
  LOSER_XP_SHARE,
  mergePlayableMoveIds,
  PLAYABLE_LEARN_METHOD,
  pruneLoadout,
  xpFromDefeat,
} from "@/src/modules/pokedex";

// Crédito de XP no fim da partida — o que faz o nível SUBIR e, por
// consequência, o learnset LIBERAR cartas novas (pokedex/domain/learnset.ts).
// Sem isto o nível seria decorativo: todo pokémon ficaria pra sempre no nível
// de captura, com o mesmo punhado de cartas.
//
// A fórmula é a da série (gen 5+): baseExperience do DERROTADO × nível dele / 7
// (ver pokedex/domain/leveling.ts). O único desvio consciente é o perdedor
// levar LOSER_XP_SHARE do que levaria — sem isso, quem perde nunca destrava
// nada e entra numa espiral.
//
// Roda DENTRO da transação que encerra a partida (resolveTurn.ts). Não é
// idempotente por si só, e não precisa ser: o claim otimista do `Battle`
// garante que só UMA lambda chega aqui. Fora daquela transação, isto pagaria
// XP duplicado a cada polling.

/** O snapshot de um combatente, do jeito que a linha do banco entrega. */
interface CombatantRow {
  userPokemonId: string | null;
  pokemonId: number; // pokemonApiId da espécie
  level: number;
}

export interface XpAward {
  userPokemonId: string;
  gainedXp: number;
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

/**
 * Aplica o XP. `xp` é o TOTAL acumulado e `level` é função dele (levelFromXp),
 * então os dois são reescritos juntos — não existe par (level, xp) inválido.
 *
 * Lê-e-escreve dentro da transação em vez de um `increment` atômico porque o
 * nível precisa ser RECALCULADO a partir do total novo, e isso não cabe num
 * update declarativo. A corrida que isso abriria (duas partidas do mesmo
 * pokémon terminando juntas) não existe: um jogador só está em uma partida por
 * vez (enqueueBattle barra).
 */
export async function awardBattleXp(tx: Prisma.TransactionClient, context: XpContext): Promise<void> {
  const awards = [context.winner, context.loser].filter((a): a is XpAward => a !== null && a.gainedXp > 0);
  if (awards.length === 0) return;

  const rows = await tx.userPokemon.findMany({
    where: { id: { in: awards.map((a) => a.userPokemonId) } },
    select: {
      id: true,
      xp: true,
      pokemon: { select: { evolvesToApiId: true, evolvesToLevel: true } },
    },
  });

  for (const award of awards) {
    const row = rows.find((r) => r.id === award.userPokemonId);
    if (!row) continue; // pokémon solto da coleção no meio da partida
    const progress = applyXp(row.xp, award.gainedXp);
    await tx.userPokemon.update({
      where: { id: row.id },
      data: { xp: progress.xp, level: progress.level },
    });
    // Subiu de nível → pode ter cruzado o gatilho de evolução. Só checa quando
    // ganhou nível (não a cada XP). NÃO toca no snapshot da partida (BattlePokemon
    // é congelado): a evolução vale da PRÓXIMA batalha, que reconstrói do UserPokemon.
    if (progress.gained > 0) {
      await maybeEvolve(tx, row.id, row.pokemon, progress.level);
    }
  }
}

/**
 * Evolui o UserPokemon enquanto o nível bater o gatilho da espécie atual — em
 * cadeia (um XP grande pode cruzar Charmander→Charmeleon→Charizard de uma vez).
 * Troca `pokemonId` pela espécie nova e PODA o loadout (decisão do dono): as
 * cartas que a nova espécie não conhece saem. Para se o alvo não está no espelho
 * (seed parcial) — sem espécie de destino, não há pra onde evoluir.
 */
async function maybeEvolve(
  tx: Prisma.TransactionClient,
  userPokemonId: string,
  species: { evolvesToApiId: number | null; evolvesToLevel: number | null },
  level: number,
): Promise<void> {
  let current = species;
  // Guarda contra ciclo de dado ruim na cadeia (não deveria existir, mas o loop
  // seria infinito): o teto de evoluções por passada é curto.
  for (let step = 0; step < 5; step++) {
    const targetApiId = evolutionTargetFor(current, level);
    if (targetApiId == null) return;

    const next = await tx.pokemon.findUnique({
      where: { pokemonApiId: targetApiId },
      select: { id: true, evolvesToApiId: true, evolvesToLevel: true },
    });
    if (!next) return; // alvo fora do espelho

    await tx.userPokemon.update({ where: { id: userPokemonId }, data: { pokemonId: next.id } });
    await pruneLoadoutForSpecies(tx, userPokemonId, next.id, level);

    current = { evolvesToApiId: next.evolvesToApiId, evolvesToLevel: next.evolvesToLevel };
  }
}

/**
 * Poda os loadouts do UserPokemon depois da evolução: apaga as DeckSlotCard cujo
 * move a NOVA espécie não conhece por level-up já destravado no nível atual. A
 * decisão de QUAIS sobrevivem é pura (pokedex/domain/pruneLoadout); aqui é só o
 * I/O. Slots podem ficar com buracos na `order` (só apagamos) — a batalha lê as
 * cartas por ordem crescente, então buraco não quebra nada.
 */
async function pruneLoadoutForSpecies(
  tx: Prisma.TransactionClient,
  userPokemonId: string,
  newSpeciesId: string,
  level: number,
): Promise<void> {
  const slots = await tx.deckSlot.findMany({
    where: { userPokemonId },
    select: { id: true, cards: { select: { moveId: true } } },
  });
  if (slots.length === 0) return;

  // Válidas = level-up da NOVA espécie já destravadas ∪ as CONCEDIDAS por fora
  // (TM/tutor/ovo). As concedidas persistem na evolução (são do UserPokemon, não
  // da espécie) — como na série, evoluir não apaga golpe já sabido. Sem juntá-las
  // aqui, um egg/TM suado sumiria do loadout ao evoluir.
  const [valid, granted] = await Promise.all([
    tx.pokemonMove.findMany({
      where: { pokemonId: newSpeciesId, learnMethod: PLAYABLE_LEARN_METHOD, levelLearnedAt: { lte: level } },
      select: { moveId: true },
    }),
    tx.userPokemonMove.findMany({ where: { userPokemonId }, select: { moveId: true } }),
  ]);
  const validSet = mergePlayableMoveIds(valid.map((v) => v.moveId), granted.map((g) => g.moveId));

  for (const slot of slots) {
    const currentIds = slot.cards.map((c) => c.moveId);
    const kept = new Set(pruneLoadout(currentIds, validSet));
    const orphans = currentIds.filter((id) => !kept.has(id));
    if (orphans.length > 0) {
      await tx.deckSlotCard.deleteMany({ where: { deckSlotId: slot.id, moveId: { in: orphans } } });
    }
  }
}
