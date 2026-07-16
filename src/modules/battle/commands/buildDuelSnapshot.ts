import { fetchAndCacheType } from "@/src/lib/pokeapiCache";
import { DECK_LIMIT, readDeckSlots, type DeckLoadoutSlot } from "@/src/modules/deck";
import { deriveStats } from "@/src/modules/pokedex";
import type { BattleMoveDef, BattlePokemonState } from "../domain/types";
import type { TypeEffectivenessMap } from "../domain/typeChart";

// Tradutor entre o ESPELHO LOCAL (Pokemon/Move/UserPokemon/DeckSlot) e o
// snapshot de batalha. Diferença de fundo pro antigo buildTeamSnapshot: NÃO
// bate mais na PokéAPI ao vivo pra montar o time — tudo vem do nosso banco
// (Fase 0 semeou o espelho). Só o buildTypeChart ainda lê /type (cache-backed),
// e mesmo assim fora da transação. Os stats derivam do NÍVEL do UserPokemon via
// deriveStats (não mais nível 50 fixo), e as cartas são o loadout escolhido
// (DeckSlotCard → Move), não os "4 primeiros moves de dano" da API.

const DAMAGE_CLASSES = new Set(["physical", "special", "status"]);

function toBattleMove(card: DeckLoadoutSlot["cards"][number]): BattleMoveDef {
  const { move } = card;
  const damageClass = DAMAGE_CLASSES.has(move.damageClass)
    ? (move.damageClass as BattleMoveDef["damageClass"])
    : "physical";
  return {
    id: move.moveApiId,
    name: move.name,
    type: move.type,
    power: move.power,
    accuracy: move.accuracy,
    damageClass,
    priority: move.priority,
    maxPp: move.pp,
    currentPp: move.pp,
  };
}

function toPokemonState(slot: DeckLoadoutSlot, index: number): BattlePokemonState {
  const { pokemon } = slot.userPokemon;
  const derived = deriveStats(pokemon.baseStats, slot.userPokemon.level);
  return {
    slot: index + 1, // posição no time (1×1 usa o slot 1)
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
    moves: slot.cards.map(toBattleMove),
  };
}

export interface BattleTeamMember {
  state: BattlePokemonState;
  spriteUrl: string | null;
}

/**
 * Monta o time de batalha a partir do deck (loadouts). No 1×1 só o slot ativo
 * (o 1º) entra em campo, mas o time inteiro é montado — o schema fica pronto pra
 * time numa fase futura. Lança se o deck estiver vazio (sem loadout jogável).
 */
export async function buildDuelSnapshot(userId: string, deckId: string): Promise<BattleTeamMember[]> {
  const slots = await readDeckSlots(userId, deckId, DECK_LIMIT);
  if (slots.length === 0) throw new Error("Deck vazio ou não encontrado");

  return slots.map((slot, index) => {
    if (slot.cards.length === 0) {
      throw new Error(`Loadout do slot ${index} sem cartas`);
    }
    return { state: toPokemonState(slot, index), spriteUrl: slot.userPokemon.pokemon.spriteUrl };
  });
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
