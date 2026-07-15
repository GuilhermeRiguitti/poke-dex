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
