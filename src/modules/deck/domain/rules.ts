// Regras do deck. Puras: sem Prisma, sem fetch, sem React.

/** Um deck tem no máximo 6 loadouts (slots) — o time do jogo. */
export const DECK_LIMIT = 6;

/**
 * Teto de cartas (skills) por loadout — a barra de golpes.
 *
 * É TETO, não obrigação: com o learnset liberado por nível (a espécie só
 * conhece o que já aprendeu), um pokémon recém-capturado tem menos de 6 cartas
 * disponíveis. Exigir 6 travaria a montagem de deck no começo do jogo.
 */
export const CARDS_PER_SLOT = 6;

export function isDeckFull(slotCount: number): boolean {
  return slotCount >= DECK_LIMIT;
}

// `moveSlot` e `firstFreeOrder` SAÍRAM daqui quando o deck virou posicional.
//
// As duas eram a conta de uma lista COMPACTA: `moveSlot` empurrava os vizinhos
// pra abrir espaço, e `firstFreeOrder` procurava o buraco que uma remoção tinha
// deixado na sequência. Com vaga como endereço fixo (domain/deckDraft.ts) não
// há empurrão nem buraco pra procurar: soltar no 3 grava no 3, e a vaga vazia é
// simplesmente `null`. O equivalente de hoje é `placeInSlot` e `firstFreeIndex`.
