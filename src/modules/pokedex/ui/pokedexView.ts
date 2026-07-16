// Direto do domain/ do deck, NÃO do barrel (@/src/modules/deck): o barrel é a
// API de servidor do módulo e reexporta queries/commands, que importam Prisma.
// Isto aqui é ui/ — se importasse o barrel, o Prisma iria parar no bundle do
// browser. domain/ é puro, e é a única coisa que ui/ pode puxar de outro módulo.
import { DECK_LIMIT, canToggleIntoDeck } from "@/src/modules/deck/domain/rules";
import type { CollectionDTO, PokemonDetailDTO } from "./types";

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
  inDeck: boolean;
  /** id do DeckSlot, pra remover do deck. null quando não está no deck. */
  deckSlotId: string | null;
  /** false = não dá pra montar mais um loadout (deck cheio e este não está nele) */
  canToggle: boolean;
}

export interface DeckSlotView {
  /** null = vaga vazia */
  pokemonId: number | null;
  name: string | null;
  iconUrl: string | null;
  level: number | null;
}

export interface CollectionView {
  cards: CollectionCardView[];
  /** sempre DECK_LIMIT vagas, na ordem — as vazias vêm com pokemonId null */
  deckSlots: DeckSlotView[];
  deckCount: number;
  deckLimit: number;
  isEmpty: boolean;
}

export function collectionView(collection: CollectionDTO): CollectionView {
  const slots = collection.deck?.slots ?? [];
  const deckCount = slots.length;

  // userPokemonId -> id do DeckSlot. Diz se um pokémon está no deck e com que id
  // o loadout dele sai.
  const slotByUserPokemon = new Map(slots.map((s) => [s.userPokemonId, s.id]));

  const cards: CollectionCardView[] = collection.cards.map((card) => {
    const deckSlotId = slotByUserPokemon.get(card.userPokemonId) ?? null;
    const inDeck = deckSlotId !== null;

    return {
      userPokemonId: card.userPokemonId,
      pokemonId: card.pokemonId,
      dexNumber: dexNumber(card.pokemonId),
      name: card.pokemon?.name ?? dexNumber(card.pokemonId),
      artworkUrl: card.pokemon?.artworkUrl ?? null,
      types: card.pokemon?.types ?? [],
      accentType: card.pokemon?.types[0] ?? "normal",
      level: card.level,
      inDeck,
      deckSlotId,
      canToggle: canToggleIntoDeck(deckCount, inDeck),
    };
  });

  const cardByUserPokemonId = new Map(collection.cards.map((c) => [c.userPokemonId, c]));

  const deckSlots: DeckSlotView[] = Array.from({ length: DECK_LIMIT }, (_, i) => {
    const slot = slots[i];
    const card = slot ? cardByUserPokemonId.get(slot.userPokemonId) : undefined;

    if (!card) return { pokemonId: null, name: null, iconUrl: null, level: null };

    return {
      pokemonId: card.pokemonId,
      name: card.pokemon?.name ?? dexNumber(card.pokemonId),
      iconUrl: card.pokemon?.iconUrl ?? null,
      level: card.level,
    };
  });

  return {
    cards,
    deckSlots,
    deckCount,
    deckLimit: DECK_LIMIT,
    isEmpty: collection.cards.length === 0,
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
