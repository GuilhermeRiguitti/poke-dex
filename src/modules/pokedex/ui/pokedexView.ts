import type { BaseStats } from "@/src/modules/progression/domain/leveling";
import type { RarityTier } from "@/src/modules/packs/domain/rarity";

import { hasActiveFilter } from "../domain/collectionFilters";
import type { CollectionPageDTO, PokemonDetailDTO } from "../types";

// Mapear DTO -> o que a tela desenha é função pura, mora aqui e tem teste.
// Componente é costura. (CLAUDE.md, regra 4 — ver battle/ui/battleView.ts.)

/** O número da dex como o card mostra: 25 -> "#0025". */
export function dexNumber(pokemonId: number): string {
  return `#${String(pokemonId).padStart(4, "0")}`;
}

export interface CollectionCardView {
  userPokemonId: string;
  pokemonId: number;
  dexNumber: string;
  /** o nome, ou "#0025" quando a espécie não veio do espelho */
  name: string;
  artworkUrl: string | null;
  types: string[];
  /** tipo que pinta a moldura (--type-c). "normal" quando não se sabe. */
  accentType: string;
  level: number;
  /** fortitude (soma dos base stats) e a raridade derivada — moldura + holo */
  bst: number;
  rarity: RarityTier;
  /** base stats da espécie — a carta deriva o número e usa a base na barra */
  baseStats: BaseStats;
}

export type CollectionEmptyState = "none" | "collection" | "filter" | "all_in_deck";

export interface CollectionView {
  cards: CollectionCardView[];
  page: number;
  totalPages: number;
  totalCards: number;
  /**
   * Qual vazio mostrar. "collection" = não tem carta nenhuma (manda capturar);
   * "all_in_deck" = tem cartas, mas todas já estão montadas no deck (não manda
   * nada — é um estado saudável); "filter" = tem cartas disponíveis, o filtro é
   * que não achou (manda limpar). São telas diferentes, e sem os dois totais +
   * os filtros não dá pra distinguir.
   */
  emptyState: CollectionEmptyState;
}

/**
 * A coleção que a tela desenha. NÃO sabe nada do deck: a listagem nem inclui
 * quem já está numa vaga (`buildCollectionWhere` exclui no banco), então toda
 * carta aqui é "disponível pra montar". Quem desenha o deck é o
 * `deckBoardView`, a partir da query dele. Entrar com o deck cheio é barrado
 * pelo SERVIDOR (addToDeck → "deck_full"), não pela tela.
 */
export function collectionView(page: CollectionPageDTO): CollectionView {
  const cards: CollectionCardView[] = page.cards.map((card) => ({
    userPokemonId: card.userPokemonId,
    pokemonId: card.pokemonId,
    dexNumber: dexNumber(card.pokemonId),
    name: card.pokemon?.name ?? dexNumber(card.pokemonId),
    artworkUrl: card.pokemon?.artworkUrl ?? null,
    types: card.pokemon?.types ?? [],
    accentType: card.pokemon?.types[0] ?? "normal",
    level: card.level,
    bst: card.bst,
    rarity: card.rarity,
    // passa CRU: a carta precisa da base pra barra (perfil da espécie) e do
    // nível pro número (derivado). Quem faz as duas contas é o `statBars`,
    // que é puro e testado (CLAUDE.md, regra 4).
    baseStats: card.baseStats,
  }));

  // `totalInCollection` conta TUDO que o jogador tem, inclusive o que está no
  // deck; `cards` já vem sem os do deck. Sem separar "all_in_deck", quem montou
  // a coleção inteira veria "limpar filtros" sem ter filtro nenhum ativo.
  const emptyState: CollectionEmptyState =
    page.cards.length > 0
      ? "none"
      : page.totalInCollection === 0
        ? "collection"
        : hasActiveFilter(page.filters)
          ? "filter"
          : "all_in_deck";

  return {
    cards,
    page: page.page,
    totalPages: page.totalPages,
    totalCards: page.totalCards,
    emptyState,
  };
}

// ─── página de detalhe ────────────────────────────────────────────────────

const STAT_LABELS: Record<string, string> = {
  hp: "HP",
  attack: "Ataque",
  defense: "Defesa",
  "special-attack": "At. Especial",
  "special-defense": "Def. Especial",
  speed: "Velocidade",
};

/** Teto das barras de stat. 255 é o maior base stat do jogo (Blissey, HP). */
export const STAT_MAX = 255;

export interface StatBarView {
  key: string;
  label: string;
  value: number;
  max: number;
}

export interface DetailView {
  name: string;
  dexNumber: string;
  artworkUrl: string | null;
  types: string[];
  /** tipo que pinta a moldura (--type-c) e a placa do nome */
  accentType: string;
  statBars: StatBarView[];
  /** a PokéAPI dá decímetros e hectogramas; a tela mostra m e kg */
  heightMeters: string;
  weightKg: string;
  /** nomes de move vêm com hífen ("thunder-punch") */
  moveNames: string[];
  totalMoves: number;
}

export function detailView(pokemon: PokemonDetailDTO): DetailView {
  return {
    name: pokemon.name,
    dexNumber: dexNumber(pokemon.id),
    artworkUrl: pokemon.artworkUrl,
    types: pokemon.types,
    accentType: pokemon.types[0] ?? "normal",
    statBars: pokemon.stats.map((s) => ({
      key: s.name,
      label: STAT_LABELS[s.name] ?? s.name,
      value: s.value,
      max: STAT_MAX,
    })),
    heightMeters: (pokemon.height / 10).toFixed(1),
    weightKg: (pokemon.weight / 10).toFixed(1),
    moveNames: pokemon.moves.map((m) => m.replace(/-/g, " ")),
    totalMoves: pokemon.totalMoves,
  };
}
