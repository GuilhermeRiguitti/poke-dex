// Regras do deck. Puras: sem Prisma, sem fetch, sem React.

/** Um deck tem no máximo 6 loadouts (slots) — o time do jogo. */
export const DECK_LIMIT = 6;

/** Cada loadout (slot) tem exatamente 6 cartas (skills) — a barra de golpes. */
export const CARDS_PER_SLOT = 6;

export function isDeckFull(slotCount: number): boolean {
  return slotCount >= DECK_LIMIT;
}

/**
 * Um pokémon já no deck sempre pode ser mexido (pra sair). Um de fora só entra
 * se ainda houver vaga.
 *
 * O `alreadyInDeck` não é detalhe: sem ele, o botão "No deck ✓" do 6º pokémon
 * apareceria desabilitado quando o deck enchesse, e o jogador não conseguiria
 * mais TIRAR ninguém do deck — ficaria travado num time que não pode editar.
 */
export function canToggleIntoDeck(slotCount: number, alreadyInDeck: boolean): boolean {
  return alreadyInDeck || !isDeckFull(slotCount);
}
