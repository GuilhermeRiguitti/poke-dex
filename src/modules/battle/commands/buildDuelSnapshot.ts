import { fetchAndCacheType } from "@/src/lib/pokeapiCache";
import { DECK_LIMIT, defaultLoadout, readDeckSlots, type DeckLoadoutSlot } from "@/src/modules/deck";
import { deriveStats, readLearnset } from "@/src/modules/pokemon";
import { loadMoveDefs } from "../queries/loadMoveDefs";
import type { BattleMoveDef, BattlePokemonState } from "../domain/types";
import type { TypeEffectivenessMap } from "../domain/typeChart";

// Tradutor entre o ESPELHO LOCAL (Pokemon/Move/UserPokemon/DeckSlot) e o
// snapshot de batalha. Diferença de fundo pro antigo buildTeamSnapshot: NÃO
// bate mais na PokéAPI ao vivo pra montar o time — tudo vem do nosso banco
// (Fase 0 semeou o espelho). Só o buildTypeChart ainda lê /type (cache-backed),
// e mesmo assim fora da transação. Os stats derivam do NÍVEL do UserPokemon via
// deriveStats (não mais nível 50 fixo), e as cartas são o loadout escolhido
// (DeckSlotCard → Move), não os "4 primeiros moves de dano" da API.

function toPokemonState(slot: DeckLoadoutSlot, index: number, moves: BattleMoveDef[]): BattlePokemonState {
  const { pokemon } = slot.userPokemon;
  const derived = deriveStats(pokemon.baseStats, slot.userPokemon.level);
  return {
    slot: index + 1, // posição no time (1..6); o slot 1 começa em campo
    userPokemonId: slot.userPokemon.id,
    pokemonId: pokemon.pokemonApiId,
    name: pokemon.name,
    types: pokemon.types,
    level: slot.userPokemon.level,
    stats: {
      hp: derived.hp,
      attack: derived.attack,
      defense: derived.defense,
      specialAttack: derived.specialAttack,
      specialDefense: derived.specialDefense,
      speed: derived.speed,
    },
    maxHp: derived.hp,
    currentHp: derived.hp,
    fainted: false,
    moves,
  };
}

/**
 * A barra com que cada pokémon ENTRA no snapshot: as skills mais fortes já
 * desbloqueadas (`defaultLoadout`).
 *
 * Não é mais o loadout do deck — o deck não guarda skill nenhuma desde que a
 * escolha virou decisão de batalha. Isto aqui é o **fallback**: é com esta barra
 * que o pokémon entra quando o jogador não escolhe a tempo (o round 0 vence, ou
 * a troca forçada auto-promove). Quem escolhe sobrescreve na entrada.
 *
 * Roda uma vez por partida, na criação — fora de qualquer transação.
 */
async function defaultMovesFor(userId: string, slot: DeckLoadoutSlot): Promise<BattleMoveDef[]> {
  const learnset = await readLearnset(userId, slot.userPokemon.id);
  const ids = defaultLoadout((learnset ?? []).filter((c) => c.unlocked));
  return loadMoveDefs(ids);
}

export interface BattleTeamMember {
  state: BattlePokemonState;
  spriteUrl: string | null;
}

/**
 * Monta o time de batalha a partir do deck (loadouts) — até DECK_LIMIT (6)
 * pokémons. O slot 1 entra em campo; os outros são a reserva, que a troca
 * (voluntária ou forçada por desmaio) coloca em jogo. Lança se o deck estiver
 * vazio (sem loadout jogável).
 */
export async function buildDuelSnapshot(userId: string, deckId: string): Promise<BattleTeamMember[]> {
  const slots = await readDeckSlots(userId, deckId, DECK_LIMIT);
  if (slots.length === 0) throw new Error("Deck vazio ou não encontrado");

  return Promise.all(
    slots.map(async (slot, index) => {
      const moves = await defaultMovesFor(userId, slot);
      // Sem NENHUMA skill liberada o pokémon não teria ação nenhuma em campo.
      // O saveDeck já barra isso na entrada do deck; aqui é a rede de baixo.
      if (moves.length === 0) {
        throw new Error(`${slot.userPokemon.pokemon.name} não tem nenhuma skill liberada`);
      }
      return {
        state: toPokemonState(slot, index, moves),
        spriteUrl: slot.userPokemon.pokemon.spriteUrl,
      };
    })
  );
}

// Matriz de efetividade cobrindo os tipos (de corpo e de carta) presentes no
// time. Dado real do endpoint /type da PokéAPI (via cache). A única coisa nossa
// é buscar só os tipos relevantes pra essa partida, não os 18 do jogo. Roda
// ANTES da transação em resolveTurn — I/O de rede não segura transação aberta.
export async function buildTypeChart(pokemons: BattlePokemonState[]): Promise<TypeEffectivenessMap> {
  const typeNames = new Set<string>();
  for (const mon of pokemons) {
    for (const t of mon.types) typeNames.add(t);
    for (const mv of mon.moves) typeNames.add(mv.type);
  }

  const chart: TypeEffectivenessMap = {};
  await Promise.all(
    Array.from(typeNames).map(async (typeName) => {
      const type = await fetchAndCacheType(typeName);
      if (!type) return;
      const row: Record<string, number> = {};
      for (const t of type.doubleDamageTo) row[t] = 2;
      for (const t of type.halfDamageTo) row[t] = 0.5;
      for (const t of type.noDamageTo) row[t] = 0;
      chart[typeName] = row;
    })
  );

  return chart;
}
