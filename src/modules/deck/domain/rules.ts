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

/**
 * A primeira posição livre do time (0..DECK_LIMIT-1), ou null se não há vaga.
 *
 * NÃO é "quantos slots existem". Tirar um loadout do MEIO deixa um buraco —
 * `removeFromDeck` só apaga a linha, não renumera os outros — e aí a contagem
 * aponta pra uma posição JÁ OCUPADA: o insert batia na @@unique([deckId, order])
 * e o POST devolvia 500. Só não estourava quando o removido era o ÚLTIMO, que é
 * justamente o único caso em que não sobra buraco.
 *
 * Procurar o buraco também é o que o jogador espera: ele tirou o do meio pra pôr
 * outro NAQUELE lugar, e a vaga liberada é a que se preenche.
 */
/**
 * Move um item de `from` pra `to`, empurrando o resto — a conta do sortable.
 *
 * Empurra, NÃO troca: soltar a carta na posição 2 põe ela ali e desliza quem
 * estava de 2 pra baixo (é o que Trello/Notion fazem, e o que o jogador espera
 * ao ver as vagas abrindo espaço enquanto arrasta). Trocar A↔B deixaria o time
 * numa ordem que ninguém pediu.
 *
 * Índice fora da lista devolve a lista igual — arrastar pro nada não reordena.
 */
export function moveSlot<T>(list: T[], from: number, to: number): T[] {
  if (from === to) return list;
  if (from < 0 || from >= list.length) return list;
  if (to < 0 || to >= list.length) return list;

  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function firstFreeOrder(taken: number[]): number | null {
  const used = new Set(taken);
  for (let i = 0; i < DECK_LIMIT; i++) {
    if (!used.has(i)) return i;
  }
  return null;
}
