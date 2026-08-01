// O que a barra de filtros DESENHA. Puro e testado — componente é costura
// (CLAUDE.md, regra 4). Importa só de domain/, nunca de queries/commands.

import {
  POKEMON_TYPES,
  RARITY_TIERS,
  collectionHref,
  hasActiveFilter,
  type CollectionFilters,
} from "../domain/collectionFilters";

export interface FilterOption {
  value: string;
  label: string;
}

export interface CollectionFilterView {
  query: string;
  typeOptions: FilterOption[];
  rarityOptions: FilterOption[];
  sortOptions: FilterOption[];
  selectedType: string;
  selectedRarity: string;
  selectedSort: string;
  showClear: boolean;
  /** href que zera busca/tipo/raridade mas PRESERVA a ordenação */
  clearHref: string;
}

const RARITY_LABELS: Record<string, string> = {
  common: "Comum",
  uncommon: "Incomum",
  rare: "Rara",
  legendary: "Lendária",
};

// Os nomes de tipo vêm da PokéAPI em inglês e minúsculo ("fire"). A tela é em
// português, e a tradução é decisão de apresentação — mora aqui.
const TYPE_LABELS: Record<string, string> = {
  normal: "Normal",
  fire: "Fogo",
  water: "Água",
  electric: "Elétrico",
  grass: "Planta",
  ice: "Gelo",
  fighting: "Lutador",
  poison: "Venenoso",
  ground: "Terrestre",
  flying: "Voador",
  psychic: "Psíquico",
  bug: "Inseto",
  rock: "Pedra",
  ghost: "Fantasma",
  dragon: "Dragão",
  dark: "Sombrio",
  steel: "Aço",
  fairy: "Fada",
};

export function collectionFilterView(filters: CollectionFilters): CollectionFilterView {
  return {
    query: filters.q ?? "",
    typeOptions: [
      { value: "", label: "Todos os tipos" },
      ...POKEMON_TYPES.map((t) => ({ value: t, label: TYPE_LABELS[t] ?? t })),
    ],
    rarityOptions: [
      { value: "", label: "Todas as raridades" },
      ...RARITY_TIERS.map((r) => ({ value: r, label: RARITY_LABELS[r] ?? r })),
    ],
    sortOptions: [
      { value: "captured", label: "Ordem de captura" },
      { value: "level_desc", label: "Nível — maior primeiro" },
      { value: "level_asc", label: "Nível — menor primeiro" },
    ],
    selectedType: filters.type ?? "",
    selectedRarity: filters.rarity ?? "",
    selectedSort: filters.sort,
    showClear: hasActiveFilter(filters),
    // Ordenação NÃO é filtro: limpar "fogo" não pode desfazer "por nível".
    clearHref: collectionHref(filters, { q: null, type: null, rarity: null }),
  };
}
