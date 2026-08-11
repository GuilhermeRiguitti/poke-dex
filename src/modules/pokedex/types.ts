// Contrato de dados entre o servidor e a UI da PokéDex — a LISTA: a coleção do
// jogador e o catálogo, com filtro e paginação.
//
// O pokémon em si (`PokemonCardDTO`, `PokemonDetailDTO`) NÃO mora aqui: é do
// @/src/modules/pokemon, porque a mesma carta é desenhada pelo pacote, pelo
// deck e pela batalha. Aqui fica só o que é da listagem.

import type { RarityTier } from "@/src/modules/pokemon/domain/rarity";
import type { BaseStats } from "@/src/modules/pokemon/domain/leveling";
import type { PokemonCardDTO } from "@/src/modules/pokemon/ui/types";
import type { CollectionFilters } from "./domain/collectionFilters";

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

/**
 * Uma PÁGINA da coleção: as 16 cartas e o estado da navegação.
 *
 * NÃO carrega o deck. O deck tem a query e o DTO dele (`getDeckBoard` →
 * `DeckBoardDTO`, no módulo `deck`), porque não depende de filtro nem de
 * página. Foi juntar os dois aqui que fez a carta sumir da vaga do deck quando
 * ela caía fora da listagem.
 */
export interface CollectionPageDTO {
  cards: CollectionCardDTO[];
  page: number;
  totalPages: number;
  /** total que o FILTRO encontrou — é o que a tela conta */
  totalCards: number;
  /**
   * total sem filtro nenhum. Existe pra distinguir os dois estados vazios:
   * "coleção vazia" (vai capturar) e "o filtro não achou nada" (limpa o
   * filtro). São telas diferentes.
   */
  totalInCollection: number;
  filters: CollectionFilters;
}

export interface PokedexPageDTO {
  page: number;
  totalPages: number;
  pokemons: PokemonCardDTO[];
  /** quais desses o usuário já capturou — decide o botão "Capturar" vs "✓" */
  capturedIds: number[];
}
