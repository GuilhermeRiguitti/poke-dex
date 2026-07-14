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
  userCardId: string;
  pokemonId: number;
  dexNumber: string;
  /** o nome, ou "#0025" quando a PokéAPI não devolveu o pokémon */
  name: string;
  artworkUrl: string | null;
  types: string[];
  /** tipo que pinta a moldura (--type-c). "normal" quando não se sabe. */
  accentType: string;
  inDeck: boolean;
  /** id do DeckCard, pra remover. null quando não está no deck. */
  deckCardId: string | null;
  /** false = botão de deck desabilitado (deck cheio e este não está nele) */
  canToggle: boolean;
}

export interface DeckSlotView {
  /** null = vaga vazia */
  pokemonId: number | null;
  name: string | null;
  iconUrl: string | null;
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
  const deckCards = collection.deck?.cards ?? [];
  const deckCount = deckCards.length;

  // userCardId -> id do DeckCard. É o que diz se uma carta está no deck, e com
  // que id ela sai dele.
  const deckCardByUserCard = new Map(deckCards.map((dc) => [dc.userCardId, dc.id]));

  const cards: CollectionCardView[] = collection.cards.map((card) => {
    const deckCardId = deckCardByUserCard.get(card.userCardId) ?? null;
    const inDeck = deckCardId !== null;

    return {
      userCardId: card.userCardId,
      pokemonId: card.pokemonId,
      dexNumber: dexNumber(card.pokemonId),
      // A carta existe mesmo se a PokéAPI não respondeu — o jogador TEM esse
      // pokémon. Sem nome, cai no número da dex; sem sprite, o card desenha
      // sem sprite. O que não pode é a carta sumir da coleção por erro de rede.
      name: card.pokemon?.name ?? dexNumber(card.pokemonId),
      artworkUrl: card.pokemon?.artworkUrl ?? null,
      types: card.pokemon?.types ?? [],
      accentType: card.pokemon?.types[0] ?? "normal",
      inDeck,
      deckCardId,
      canToggle: canToggleIntoDeck(deckCount, inDeck),
    };
  });

  const cardByUserCardId = new Map(collection.cards.map((c) => [c.userCardId, c]));

  const deckSlots: DeckSlotView[] = Array.from({ length: DECK_LIMIT }, (_, i) => {
    const deckCard = deckCards[i];
    const card = deckCard ? cardByUserCardId.get(deckCard.userCardId) : undefined;

    if (!card) return { pokemonId: null, name: null, iconUrl: null };

    return {
      pokemonId: card.pokemonId,
      name: card.pokemon?.name ?? dexNumber(card.pokemonId),
      iconUrl: card.pokemon?.iconUrl ?? null,
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

export interface DetailView {
  statBars: { key: string; label: string; value: number; max: number }[];
  /** a PokéAPI dá decímetros e hectogramas; a tela mostra m e kg */
  heightMeters: string;
  weightKg: string;
  /** nomes de move vêm com hífen ("thunder-punch") */
  moveNames: string[];
  totalMoves: number;
  accentType: string;
}

export function detailView(pokemon: PokemonDetailDTO): DetailView {
  return {
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
    accentType: pokemon.types[0] ?? "normal",
  };
}
