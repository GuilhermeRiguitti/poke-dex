// Regras do deck. Puras: sem Prisma, sem fetch, sem React.

/** Um deck de batalha tem no máximo 6 pokémon (mesmo limite do time do jogo). */
export const DECK_LIMIT = 6;

export function isDeckFull(pokemonCount: number): boolean {
  return pokemonCount >= DECK_LIMIT;
}

/**
 * Um card já no deck sempre pode ser mexido (pra sair). Um card de fora só
 * entra se ainda houver vaga.
 *
 * O `alreadyInDeck` não é detalhe: sem ele, o botão "No deck ✓" do 6º pokémon
 * apareceria desabilitado quando o deck enchesse, e o jogador não conseguiria
 * mais TIRAR ninguém do deck — ficaria travado num time que não pode editar.
 */
export function canToggleIntoDeck(pokemonCount: number, alreadyInDeck: boolean): boolean {
  return alreadyInDeck || !isDeckFull(pokemonCount);
}
