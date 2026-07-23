// Contrato de dados entre o servidor e a UI, pro deck (jogo novo: loadouts).
//
// Espelho ESTREITO das linhas do Prisma: nada daqui pode ser a linha crua. A
// linha de Deck carrega userId; a de DeckSlot/DeckSlotCard carrega ids cruzados
// — nada disso precisa (nem deve) chegar no browser.

/** Uma carta (skill) escolhida num slot. `moveId` é o Move.id do espelho. */
export interface DeckSlotCardDTO {
  moveId: string;
  order: number; // 0..5, posição na barra
}

/** Um loadout do time: 1 UserPokemon + suas cartas. */
export interface DeckSlotDTO {
  /** id do DeckSlot (é o que o DELETE /api/deck/[id] recebe) */
  id: string;
  userPokemonId: string;
  order: number; // 0..5, posição no time
  cards: DeckSlotCardDTO[];
}

export interface DeckDTO {
  id: string;
  name: string;
  slots: DeckSlotDTO[];
}

/** O deck como a tela da fila precisa dele: só o tamanho, sem os membros. */
export interface DeckSummaryDTO {
  id: string;
  name: string;
  slotCount: number;
}

/** Uma carta possível do learnset — o que o seletor de loadout mostra. */
export interface LearnsetMoveDTO {
  /** Move.id (cuid) — é o que vai em moveIds no POST /api/deck */
  moveId: string;
  name: string;
  type: string;
  power: number | null;
  damageClass: "physical" | "special" | "status";
  /** nível em que a espécie aprende esta carta (dado real da PokéAPI) */
  levelLearnedAt: number;
  /** já destravada pro nível ATUAL deste pokémon? Travadas aparecem, mas não são selecionáveis. */
  unlocked: boolean;
}
