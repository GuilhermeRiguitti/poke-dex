// Contrato de dados entre o servidor e a UI da PokéDex.
//
// Nada daqui é linha do Prisma nem resposta crua da PokéAPI. O `NormalizedPokemon`
// da lib carrega o movepool INTEIRO (o Rattata tem ~130 moves, cada um com nome
// e url) — mandar isso como prop pra 20 cards de uma página da dex seria
// centenas de KB de RSC payload por navegação, pra desenhar um sprite e dois
// badges. O DTO do card tem 5 campos de propósito.

import type { RarityTier } from "@/src/modules/packs/domain/rarity";
import type { BaseStats } from "@/src/modules/progression/domain/leveling";

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

/** Um pokémon da coleção do usuário: a carta dele + nível + o pokémon em si. */
export interface CollectionCardDTO {
  /** id do UserPokemon — é o que "soltar" e "montar loadout" mandam pro servidor */
  userPokemonId: string;
  pokemonId: number; // id público da PokéAPI (National Dex)
  level: number;
  xp: number;
  /** soma dos base stats — a "fortitude" que define raridade e força do holo */
  bst: number;
  /** faixa de raridade (mesma regra do pacote), pra moldura + intensidade do holo */
  rarity: RarityTier;
  /**
   * Os 6 base stats da espécie, crus do espelho (Pokemon.baseStats). A carta
   * deriva pelo nível (deriveStats) pra desenhar as barras. Não vai derivado
   * daqui de propósito: o nível é do UserPokemon e a conversão é regra de
   * apresentação, que mora no view (pokedexView), não no DTO.
   */
  baseStats: BaseStats;
  /** null se a espécie não estiver no espelho (não deveria ocorrer — FK garante). */
  pokemon: PokemonCardDTO | null;
}

export interface CollectionDTO {
  cards: CollectionCardDTO[];
  /** null quando o jogador ainda não tem deck (ele nasce no primeiro loadout) */
  deck: { id: string; slots: { id: string; userPokemonId: string }[] } | null;
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
