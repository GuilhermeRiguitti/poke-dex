import type { Prisma } from "@prisma/client";
import { prisma } from "@/src/lib/prisma";
import { CARDS_PER_SLOT } from "@/src/modules/deck";
import {
  applyXp,
  evolutionTargetFor,
  LOSER_XP_SHARE,
  mergePlayableMoveIds,
  PLAYABLE_LEARN_METHOD,
  progressionFromXp,
  pruneLoadout,
  refillLoadout,
  xpFromDefeat,
} from "@/src/modules/progression";

// Crédito de XP no fim da partida — o que faz o nível SUBIR e, por
// consequência, o learnset LIBERAR cartas novas (progression/domain/learnset.ts).
// Sem isto o nível seria decorativo: todo pokémon ficaria pra sempre no nível
// de captura, com o mesmo punhado de cartas.
//
// A fórmula é a da série (gen 5+): baseExperience do DERROTADO × nível dele / 7
// (ver progression/domain/leveling.ts). O único desvio consciente é o perdedor
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
      // `progressionFromXp` reafirma o par por construção. `applyXp` já devolve
      // os dois casados; passar pelo helper é o que impede um escritor futuro
      // de gravar só um dos campos.
      data: progressionFromXp(progress.xp),
    });
    // Evolução RETROATIVA: checa em toda aplicação de XP, não só quando subiu
    // de nível. Aqui não existe worker pra consertar estado depois (CLAUDE.md
    // §5), então o estado tem que se curar quando alguém chega — mesmo padrão
    // do timeout de turno. Sem isto, um pokémon que cruzou o gatilho enquanto a
    // espécie-alvo não estava no espelho ficava preso na forma antiga pra
    // sempre (no MAX_LEVEL nunca mais há nível ganho, então a checagem nunca
    // voltava).
    //
    // Custo ZERO no caso saudável: `evolutionTargetFor` é puro e devolve null
    // sem tocar no banco quando o nível não bate o gatilho da espécie atual —
    // e quem já evoluiu aponta pro estágio seguinte, cujo nível é mais alto.
    // A ida ao banco só acontece no caso que estava quebrado.
    //
    // NÃO toca no snapshot da partida (BattlePokemon é congelado): a evolução
    // vale da PRÓXIMA batalha, que reconstrói do UserPokemon.
    await maybeEvolve(tx, row.id, row.pokemon, progress.level);
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
 * move a NOVA espécie não conhece por level-up já destravado no nível atual, e
 * REPÕE o slot que a poda tiver esvaziado. As duas decisões são puras
 * (progression/domain/evolution: pruneLoadout + refillLoadout); aqui é só o I/O.
 *
 * A reposição não é enfeite: slot vazio deixa o pokémon INJOGÁVEL
 * (`buildDuelSnapshot` lança) e derrubava o matchmaking — ver refillLoadout.
 *
 * Slots podem ficar com buracos na `order` (só apagamos) — a batalha lê as
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
      select: { moveId: true, levelLearnedAt: true },
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

    // Só entra quando a poda zerou o slot; senão `refillLoadout` devolve o que
    // sobreviveu e não há nada a criar. As candidatas são as level-up da espécie
    // nova (se o slot tivesse uma carta de TM, ela teria sobrevivido — as
    // concedidas estão no validSet — e o slot não estaria vazio).
    const added = refillLoadout([...kept], valid, CARDS_PER_SLOT).filter((id) => !kept.has(id));
    if (added.length > 0) {
      await tx.deckSlotCard.createMany({
        data: added.map((moveId, order) => ({ deckSlotId: slot.id, moveId, order })),
      });
    }
  }
}
