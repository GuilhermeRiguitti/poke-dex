import { prisma } from "@/src/lib/prisma";
import { extractIdFromUrl, fetchMove, fetchPokemon, fetchType, NormalizedMove, NormalizedPokemon, NormalizedType } from "@/src/lib/pokeapi";
import { BATTLE_LEVEL, calcHp, calcStat } from "../domain/stats";
import { BattleMoveDef, BattlePokemonState } from "../domain/types";
import { TypeEffectivenessMap } from "../domain/typeChart";

// Este arquivo é o "tradutor" entre a PokéAPI e o sistema de batalha: pega
// dados crus da API (nome, tipos, base stats, movepool, tipo dos moves) e
// monta o BattlePokemonState que o engine.ts usa. É aqui que fica mais claro
// o que é da API e o que é invenção nossa — ver comentários em cada função.

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

// Escolhe até 4 moves de dano do movepool do pokémon.
// DA POKÉAPI: a lista completa de moves que o pokémon PODE aprender
// (pokemon.moves, que vem de "todo move de todo jogo/método" — não filtra
// por versão/nível/HM etc.), e os detalhes de cada move (type, power,
// accuracy, damageClass, priority, pp) via /move.
// NOSSO: a REGRA DE ESCOLHA. O jogo real deixa o jogador escolher/ensinar
// moves; aqui pegamos simplesmente os 4 PRIMEIROS moves de dano (power
// definido, exclui moves de status como "growl") na ordem que a API devolve
// — não é otimizado, não considera nível, não há "moveset" pensado por
// pokémon. Golpes de status (sem dano) são ignorados inteiramente: esse
// sistema não tem buffs/debuffs/efeitos, só troca de HP.
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
    // Fallback 100% inventado (não existe na PokéAPI): se por algum motivo o
    // pokémon não tem nenhum move de dano no movepool, damos um "struggle"
    // genérico pra ele não ficar sem poder atacar. Valores (power 50, normal,
    // sempre acerta) são um chute nosso, não vêm do struggle real do jogo.
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

// Monta o time de batalha (até 6) a partir do Deck ativo do usuário.
// NOSSO: quais pokémon entram no time — isso vem do Deck do usuário (dados
// do NOSSO banco: deckCards -> userCard -> pokemonId), não da PokéAPI. A
// API só entra depois, pra buscar os dados de CADA pokémon já escolhido
// (types, base stats, moves, sprite). Também é nosso: slot = índice no
// deck (ordem em que o card foi adicionado), level sempre BATTLE_LEVEL,
// stats calculados por calcHp/calcStat (fórmula do jogo, mas sem IV/EV).
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
        slot: index + 1, // NOSSO: posição no deck, não da API
        pokemonId: pokemon.id, // DA API
        name: pokemon.name, // DA API
        types: pokemon.types.map((t) => t.type.name), // DA API (1 ou 2 tipos reais)
        level: BATTLE_LEVEL, // NOSSO: fixo em 50 pra todos, sempre
        stats: {
          hp: maxHp,
          // DA API: os base stats (statFor lê pokemon.stats). NOSSO: a
          // conversão base -> valor de batalha via calcStat/calcHp (stats.ts).
          attack: calcStat(statFor(pokemon, "attack")),
          defense: calcStat(statFor(pokemon, "defense")),
          specialAttack: calcStat(statFor(pokemon, "special-attack")),
          specialDefense: calcStat(statFor(pokemon, "special-defense")),
          speed: calcStat(statFor(pokemon, "speed")),
        },
        maxHp,
        currentHp: maxHp, // NOSSO: sempre começa cheio, sem itens de cura/status prévio
        fainted: false,
        moves, // DA API (dados) + NOSSO (regra de escolha, ver pickBattleMoves)
      };

      return { state, spriteUrl: pokemon.sprites.artwork ?? pokemon.sprites.front_default };
    })
  );
}

// Matriz de efetividade cobrindo os tipos (de corpo e de move) presentes no
// time. 100% dado real: doubleDamageTo/halfDamageTo/noDamageTo vêm direto
// do endpoint /type da PokéAPI (via NormalizedType, ver lib/pokeapi.ts).
// A única coisa nossa aqui é buscar só os tipos relevantes pra essa
// partida específica, em vez dos 18 tipos do jogo.
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
