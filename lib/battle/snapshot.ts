import { prisma } from "@/lib/prisma";
import { extractIdFromUrl, fetchMove, fetchPokemon, fetchType, NormalizedMove, NormalizedPokemon, NormalizedType } from "@/lib/pokeapi";
import { BATTLE_LEVEL, calcHp, calcStat } from "./stats";
import { BattleMoveDef, BattlePokemonState, BattleStats } from "./types";
import { TypeEffectivenessMap } from "./typeChart";

// ─── cache persistente (tabela PokeApiCache) — dados de uma geração já
// lançada não mudam, então cachear "pra sempre" entre invocações serverless
// é seguro e evita rebater na PokéAPI a cada partida/turno. ────────────────

async function cached<T>(key: string, fetcher: () => Promise<T | null>): Promise<T | null> {
  const row = await prisma.pokeApiCache.findUnique({ where: { key } });
  if (row) return row.payload as T;

  const data = await fetcher();
  if (data) {
    await prisma.pokeApiCache.upsert({
      where: { key },
      update: { payload: data as object, fetchedAt: new Date() },
      create: { key, payload: data as object },
    });
  }
  return data;
}

const cachedPokemon = (id: number) => cached<NormalizedPokemon>(`pokemon:${id}`, () => fetchPokemon(id));
const cachedMove = (id: number) => cached<NormalizedMove>(`move:${id}`, () => fetchMove(id));
const cachedType = (name: string) => cached<NormalizedType>(`type:${name}`, () => fetchType(name));

function statFor(pokemon: NormalizedPokemon, statName: string): number {
  return pokemon.stats.find((s) => s.stat.name === statName)?.base_stat ?? 50;
}

/** Escolhe até 4 moves de dano (power definido) do movepool do pokémon. */
async function pickBattleMoves(pokemon: NormalizedPokemon): Promise<BattleMoveDef[]> {
  const candidateIds = Array.from(new Set(pokemon.moves.map((m) => extractIdFromUrl(m.move.url))));

  const picked: BattleMoveDef[] = [];
  for (const moveId of candidateIds) {
    if (picked.length >= 4) break;
    const move = await cachedMove(moveId);
    if (!move || move.damageClass === "status" || !move.power) continue;
    picked.push({
      id: move.id,
      name: move.name,
      type: move.type,
      power: move.power,
      accuracy: move.accuracy,
      damageClass: move.damageClass,
      priority: move.priority,
      maxPp: move.pp,
      currentPp: move.pp,
    });
  }

  if (picked.length === 0) {
    // Pokémon sem nenhum move de dano no movepool retornado — fallback genérico.
    picked.push({
      id: 0,
      name: "struggle",
      type: "normal",
      power: 50,
      accuracy: 100,
      damageClass: "physical",
      priority: 0,
      maxPp: 1,
      currentPp: 1,
    });
  }

  return picked;
}

export interface BattleTeamMember {
  state: BattlePokemonState;
  spriteUrl: string | null;
}

/** Monta o time de batalha (até 6) a partir do Deck ativo do usuário. */
export async function buildTeamSnapshot(userId: string, deckId: string): Promise<BattleTeamMember[]> {
  const deck = await prisma.deck.findFirst({
    where: { id: deckId, userId },
    include: {
      deckCards: {
        include: { userCard: true },
        orderBy: { addedAt: "asc" },
        take: 6,
      },
    },
  });

  if (!deck || deck.deckCards.length === 0) {
    throw new Error("Deck vazio ou não encontrado");
  }

  return Promise.all(
    deck.deckCards.map(async (dc, index) => {
      const pokemon = await cachedPokemon(dc.userCard.pokemonId);
      if (!pokemon) throw new Error(`Pokémon ${dc.userCard.pokemonId} não encontrado na PokéAPI`);

      const moves = await pickBattleMoves(pokemon);
      const maxHp = calcHp(statFor(pokemon, "hp"));

      const state: BattlePokemonState = {
        slot: index + 1,
        pokemonId: pokemon.id,
        name: pokemon.name,
        types: pokemon.types.map((t) => t.type.name),
        level: BATTLE_LEVEL,
        stats: {
          hp: maxHp,
          attack: calcStat(statFor(pokemon, "attack")),
          defense: calcStat(statFor(pokemon, "defense")),
          specialAttack: calcStat(statFor(pokemon, "special-attack")),
          specialDefense: calcStat(statFor(pokemon, "special-defense")),
          speed: calcStat(statFor(pokemon, "speed")),
        },
        maxHp,
        currentHp: maxHp,
        fainted: false,
        moves,
      };

      return { state, spriteUrl: pokemon.sprites.artwork ?? pokemon.sprites.front_default };
    })
  );
}

/** Matriz de efetividade cobrindo os tipos (de corpo e de move) presentes no time. */
export async function buildTypeChart(pokemons: BattlePokemonState[]): Promise<TypeEffectivenessMap> {
  const typeNames = new Set<string>();
  for (const mon of pokemons) {
    for (const t of mon.types) typeNames.add(t);
    for (const mv of mon.moves) typeNames.add(mv.type);
  }

  const chart: TypeEffectivenessMap = {};
  await Promise.all(
    Array.from(typeNames).map(async (typeName) => {
      const type = await cachedType(typeName);
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

// ─── conversão entre o formato persistido (colunas JSON do Prisma) e os
// tipos fortes usados pelo motor puro (lib/battle/engine.ts) ──────────────

interface BattlePokemonRow {
  slot: number;
  pokemonId: number;
  name: string;
  types: unknown;
  level: number;
  stats: unknown;
  maxHp: number;
  currentHp: number;
  fainted: boolean;
  moves: unknown;
}

export function rowToBattlePokemonState(row: BattlePokemonRow): BattlePokemonState {
  return {
    slot: row.slot,
    pokemonId: row.pokemonId,
    name: row.name,
    types: row.types as string[],
    level: row.level,
    stats: row.stats as BattleStats,
    maxHp: row.maxHp,
    currentHp: row.currentHp,
    fainted: row.fainted,
    moves: row.moves as BattleMoveDef[],
  };
}
