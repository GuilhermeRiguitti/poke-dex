// Contrato de dados entre o servidor e a UI da PokéDex.
//
// Nada daqui é linha do Prisma nem resposta crua da PokéAPI. O `NormalizedPokemon`
// da lib carrega o movepool INTEIRO (o Rattata tem ~130 moves, cada um com nome
// e url) — mandar isso como prop pra 20 cards de uma página da dex seria
// centenas de KB de RSC payload por navegação, pra desenhar um sprite e dois
// badges. O DTO do card tem 5 campos de propósito.

/** Um pokémon como um CARD precisa dele. Nada além do que a moldura desenha. */
export interface PokemonCardDTO {
  id: number;
  name: string;
  /** artwork oficial (grande) — é o que o card mostra */
  artworkUrl: string | null;
  /** sprite pequeno — é o que a vaga do deck mostra */
  iconUrl: string | null;
  types: string[];
}

/** Um pokémon da coleção do usuário: a carta dele + o pokémon em si. */
export interface CollectionCardDTO {
  /** id do UserCard — é o que "soltar" e "+ deck" mandam pro servidor */
  userCardId: string;
  pokemonId: number;
  /**
   * null quando a PokéAPI não devolveu esse pokémon (cache frio + rede fora).
   * A coleção AINDA precisa desenhar a carta — o jogador tem esse pokémon, e
   * um erro de rede não pode fazer a coleção dele parecer menor do que é.
   */
  pokemon: PokemonCardDTO | null;
}

export interface CollectionDTO {
  cards: CollectionCardDTO[];
  /** null quando o jogador ainda não tem deck (ele nasce no primeiro "+ deck") */
  deck: { id: string; cards: { id: string; userCardId: string }[] } | null;
}

export interface PokedexPageDTO {
  page: number;
  totalPages: number;
  pokemons: PokemonCardDTO[];
  /** quais desses o usuário já capturou — decide o botão "Capturar" vs "✓" */
  capturedIds: number[];
}

export interface PokemonStatDTO {
  name: string;
  value: number;
}

/** O pokémon como a página de DETALHE precisa dele (aí sim, com os moves). */
export interface PokemonDetailDTO {
  id: number;
  name: string;
  artworkUrl: string | null;
  types: string[];
  /** decímetros e hectogramas, como a PokéAPI devolve — a UI converte */
  height: number;
  weight: number;
  stats: PokemonStatDTO[];
  /** só os que a tela mostra (não os ~130 do movepool) */
  moves: string[];
  totalMoves: number;
}
