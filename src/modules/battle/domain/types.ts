// Tipos base do snapshot de batalha (compartilhados entre o motor puro do
// duelo — duelTypes.ts/duelEngine.ts — e a montagem/persistência). Nada aqui
// vem direto da PokéAPI: é a nossa modelagem. Os VALORES que preenchem esses
// campos é que vêm do espelho local (Pokemon/Move) ou são calculados por nós
// (stats por nível via pokedex/domain/leveling, regras de turno).
//
// O modelo simultâneo antigo (BattleState/BattleSideState/BattleEvent + o
// engine.ts que casava duas jogadas) foi REMOVIDO na Fase A: o duelo é
// alternado (ver duelTypes.ts). Só sobrevive daqui o que o snapshot de um
// pokémon precisa — stats, cartas e HP.

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
export interface BattlePokemonState {
  slot: number;
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
