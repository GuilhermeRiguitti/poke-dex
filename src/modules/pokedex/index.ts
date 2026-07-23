// API pública do módulo pokedex — as rotas em app/api/** e as pages de (game)
// só devem importar daqui, nunca de domain/queries/commands direto.
//
// Só código de SERVIDOR. Os componentes ficam em ui/ e são importados pelas
// pages por caminho direto: se um componente "use client" fosse reexportado por
// este barrel, toda rota de API que importa um command arrastaria a UI junto.

export type {
  CollectionDTO,
  CollectionCardDTO,
  PokedexPageDTO,
  PokemonCardDTO,
  PokemonDetailDTO,
  PokemonStatDTO,
} from "./ui/types";

export { PAGE_SIZE, MAX_POKEMON, TOTAL_PAGES, clampPage, pageRange } from "./domain/pagination";

// Nível incremental + stats derivados 100% da API (PLANO_JOGO.md §6). Puro,
// sem banco — seguro em qualquer camada.
export {
  MIN_LEVEL,
  MAX_LEVEL,
  STARTING_LEVEL,
  LOSER_XP_SHARE,
  FALLBACK_BASE_EXPERIENCE,
  deriveStats,
  calcHp,
  calcStat,
  applyXp,
  xpForLevel,
  levelFromXp,
  xpToNextLevel,
  xpFromDefeat,
} from "./domain/leveling";
export type { BaseStats, DerivedStats, Progress } from "./domain/leveling";

// Learnset fiel à série: qual move a espécie aprende, por qual método e em que
// nível. É o que faz o NÍVEL liberar cartas (e o papel real do nível no jogo).
export {
  VERSION_GROUP_PREFERENCE,
  PLAYABLE_LEARN_METHOD,
  pickVersionGroup,
  pickLearnEntry,
  isUnlockedAt,
} from "./domain/learnset";
export type { LearnDetail, LearnsetEntry } from "./domain/learnset";

// Evolução por nível (PLANO_JOGO.md, fim da Fase A). Puro: a decisão de quando
// evoluir e o que podar do loadout. Quem grava a aresta é syncPokedex; quem
// troca a espécie é battle/commands/awardBattleXp.
export {
  parseLevelUpEvolutions,
  evolutionTargetFor,
  pruneLoadout,
} from "./domain/evolution";
export type { EvolutionEdge, EvolutionDetail, EvolutionChainNode } from "./domain/evolution";

// Espelho da PokéAPI (Pokemon/Move/PokemonMove). syncPokedex é o motor da seed
// e do refresh; refreshPokedex é o que a rota de cron chama. Ambos ESCREVEM —
// só command/rota, nunca render (CLAUDE.md regra 2).
export { syncPokedex } from "./commands/syncPokedex";
export type { SyncPokedexSummary, SyncPokedexOptions } from "./commands/syncPokedex";
export { refreshPokedex, DEFAULT_REFRESH_BATCH } from "./commands/refreshPokedex";
export type { RefreshPokedexSummary, RefreshPokedexOptions } from "./commands/refreshPokedex";

// Todas as queries abaixo SÓ LEEM — podem ser chamadas do render de uma page.
// A escrita (inclusive a do cache da PokéAPI) mora nos commands.
export { listPokedexPage } from "./queries/listPokedexPage";
export { getCollection } from "./queries/getCollection";
export { getPokemonDetail } from "./queries/getPokemonDetail";
// Mapper puro NormalizedPokemon → card. Exposto pro módulo packs montar a DTO
// das cartas sorteadas sem duplicar a whitelist de campos.
export { toPokemonCardDTO } from "./queries/toPokemonDTO";

// A captura direta morreu — obter pokémon é só pelo módulo packs. Só resta a
// remoção (soltar uma carta da coleção).
export { removeCard } from "./commands/removeCard";
export type { RemoveCardResult } from "./commands/removeCard";
