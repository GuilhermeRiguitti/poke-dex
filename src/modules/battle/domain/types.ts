// Tipos base do snapshot de batalha (compartilhados entre o motor puro do
// duelo — duelTypes.ts/duelEngine.ts — e a montagem/persistência). Nada aqui
// vem direto da PokéAPI: é a nossa modelagem. Os VALORES que preenchem esses
// campos é que vêm do espelho local (Pokemon/Move) ou são calculados por nós
// (stats por nível via pokedex/domain/leveling, regras de turno).
//
// Aqui mora só o que o SNAPSHOT de um pokémon precisa (stats, cartas, HP). O
// modelo do turno em si — que voltou a ser simultâneo, como na série — está em
// duelTypes.ts.

// Os 6 stats de batalha já convertidos pra valores de jogo. Os base stats crus
// vêm do espelho (Pokemon.baseStats); a conversão por nível é deriveStats
// (pokedex/domain/leveling.ts).
export interface BattleStats {
  hp: number;
  attack: number;
  defense: number;
  specialAttack: number;
  specialDefense: number;
  speed: number;
}

// Uma carta (skill) pronta pra batalha. type/power/accuracy/damageClass/
// priority/maxPp vêm do espelho Move (originalmente do endpoint /move da API).
// currentPp é nosso: o engine gasta 1 por uso (inclusive quando erra) e
// resolveTurn grava de volta na coluna Json `moves`. Sem PP em nenhuma carta, o
// ativo usa STRUGGLE (ver duelEngine.ts).
export interface BattleMoveDef {
  id: number;
  name: string;
  type: string; // nome do tipo da carta, ex: "fire"
  power: number | null;
  accuracy: number | null; // null = sempre acerta
  damageClass: "physical" | "special" | "status";
  priority: number;
  maxPp: number;
  currentPp: number;
}

// Um pokémon dentro da batalha (snapshot mutável: HP atual, se desmaiou etc).
// pokemonId/name/types = do espelho Pokemon. level = do UserPokemon do jogador.
// stats/maxHp = base stats derivados por nível (deriveStats). moves = as cartas
// do loadout (DeckSlotCard → Move), até 6.
//  - slot: posição no time (1×1 usa o ativo); o schema fica pronto pra time.
//  - userPokemonId: de qual pokémon da coleção este snapshot saiu — é o caminho
//    de volta pra creditar XP no fim (awardBattleXp). Opcional porque partidas
//    criadas antes da fatia de XP não têm o vínculo.
export interface BattlePokemonState {
  slot: number;
  userPokemonId?: string | null;
  pokemonId: number;
  name: string;
  types: string[]; // 1-2 tipos
  level: number;
  stats: BattleStats;
  maxHp: number;
  currentHp: number;
  fainted: boolean;
  moves: BattleMoveDef[]; // até 6 cartas do loadout
}
