// O RASCUNHO do deck: DECK_LIMIT vagas POSICIONAIS, cada uma com uma carta ou
// vazia. Puro: sem Prisma, sem fetch, sem React.
//
// ── Por que posicional (e não uma lista que se empurra) ────────────────────
// Antes o deck era uma lista compacta: montar punha na primeira vaga livre e
// arrastar EMPURRAVA o resto (o `moveSlot`, estilo Trello). Isso não é o que a
// tela promete — ela desenha seis quadrados numerados, e soltar uma carta no 3
// tem que deixar ela no 3, não "no 3 empurrando todo mundo pra baixo".
//
// Aqui a vaga é um endereço. `null` é buraco de verdade: dá pra ter carta na 0
// e na 4 com o meio vazio, e a posição de quem já está montado NUNCA muda por
// causa de um vizinho. A ordem importa no jogo (a vaga 0 começa em campo), então
// mexer no que o jogador não pediu é bug, não conveniência.
//
// ── Por que o rascunho é do CLIENTE ───────────────────────────────────────
// Nenhuma função daqui escreve no banco. O jogador arrasta, troca e desfaz à
// vontade sem um request por gesto; a gravação é UMA, no botão de salvar
// (commands/saveDeck.ts). É o que torna o arrastar responsivo — antes cada drop
// era um POST + `router.refresh()`, e a carta só assentava quando o servidor
// respondia.

import { DECK_LIMIT } from "./rules";

/** O mínimo que o rascunho precisa saber de uma carta: quem ela é. */
export interface DraftCard {
  userPokemonId: string;
}

/** Sempre DECK_LIMIT posições. `null` = vaga vazia. */
export type DeckDraft<T extends DraftCard> = readonly (T | null)[];

/** Um deck vazio: DECK_LIMIT buracos. */
export function emptyDraft<T extends DraftCard>(): DeckDraft<T> {
  return Array.from({ length: DECK_LIMIT }, () => null);
}

/**
 * O rascunho a partir do que está GRAVADO — cada carta na posição que o banco
 * guardou (`order`), não na ordem em que a query devolveu.
 *
 * `order` fora de 0..DECK_LIMIT-1 é dado torto (nenhum caminho de escrita gera
 * isso hoje): a carta é ignorada em vez de estourar o array. Duas cartas no
 * mesmo `order` também não deveriam existir (@@unique([deckId, order])) — a
 * primeira fica, e a regra é explícita em vez de depender da ordem da query.
 */
export function draftFrom<T extends DraftCard>(slots: readonly (T & { order: number })[]): DeckDraft<T> {
  const draft: (T | null)[] = Array.from({ length: DECK_LIMIT }, () => null);

  for (const slot of slots) {
    if (!Number.isInteger(slot.order)) continue;
    if (slot.order < 0 || slot.order >= DECK_LIMIT) continue;
    if (draft[slot.order] !== null) continue;
    draft[slot.order] = slot;
  }

  return draft;
}

/**
 * Põe `card` na vaga `index`. É a ÚNICA porta de entrada do rascunho, e cobre
 * os dois gestos com a mesma conta:
 *
 * - **veio da coleção** (não está em vaga nenhuma): ocupa a vaga. Se ela já
 *   tinha alguém, o antigo SAI do deck — volta pra coleção, que é o que a tela
 *   mostra acontecendo.
 * - **veio de outra vaga** (arrastar dentro do deck): TROCA as duas. Não
 *   empurra: o jogador escolheu duas posições, e mexer numa terceira seria
 *   reordenar o time por conta própria.
 *
 * Soltar a carta na vaga onde ela já está devolve o rascunho intacto — inclusive
 * a mesma referência, pra não disparar re-render à toa.
 */
export function placeInSlot<T extends DraftCard>(
  draft: DeckDraft<T>,
  index: number,
  card: T
): DeckDraft<T> {
  if (!isSlotIndex(index)) return draft;

  const from = indexOfCard(draft, card.userPokemonId);
  if (from === index) return draft;

  const next = [...draft];
  next[index] = card;
  // Vindo de outra vaga, a de origem recebe quem estava aqui (troca). Vindo da
  // coleção, `from` é null e o antigo simplesmente sai.
  if (from !== null) next[from] = draft[index];

  return next;
}

/** Tira a carta da vaga `index` (ela volta pra coleção). */
export function clearSlot<T extends DraftCard>(draft: DeckDraft<T>, index: number): DeckDraft<T> {
  if (!isSlotIndex(index) || draft[index] === null) return draft;

  const next = [...draft];
  next[index] = null;
  return next;
}

/**
 * A primeira vaga livre, ou null se o time está cheio.
 *
 * É o caminho do TOQUE: no celular o gesto vertical é rolar a coleção, então
 * arrastar não existe lá e o botão "pôr no time" precisa escolher a vaga
 * sozinho. Primeira livre é a escolha óbvia — depois o jogador reposiciona.
 */
export function firstFreeIndex<T extends DraftCard>(draft: DeckDraft<T>): number | null {
  const i = draft.findIndex((s) => s === null);
  return i === -1 ? null : i;
}

/** Em que vaga esta carta está, ou null se não está no rascunho. */
export function indexOfCard<T extends DraftCard>(
  draft: DeckDraft<T>,
  userPokemonId: string
): number | null {
  const i = draft.findIndex((s) => s?.userPokemonId === userPokemonId);
  return i === -1 ? null : i;
}

/** Quantas vagas estão ocupadas. */
export function countFilled<T extends DraftCard>(draft: DeckDraft<T>): number {
  return draft.reduce<number>((n, s) => (s === null ? n : n + 1), 0);
}

/**
 * O rascunho no formato que o servidor grava: só as vagas ocupadas, cada uma
 * com a POSIÇÃO dela.
 *
 * Manda `order` explícito (e não "a posição na lista") justamente porque o
 * rascunho tem buracos: um time em 0 e 4 tem que continuar em 0 e 4 depois de
 * salvar, senão salvar reordenaria o time sozinho.
 */
export function draftToSlots<T extends DraftCard>(
  draft: DeckDraft<T>
): { userPokemonId: string; order: number }[] {
  return draft.flatMap((card, order) => (card === null ? [] : [{ userPokemonId: card.userPokemonId, order }]));
}

/**
 * Os dois rascunhos são o MESMO time, nas mesmas posições?
 *
 * É o que decide se o botão de salvar tem o que salvar — e, com ele, se existe
 * edição pendente segurando a batalha.
 */
export function sameDraft<T extends DraftCard>(a: DeckDraft<T>, b: DeckDraft<T>): boolean {
  if (a.length !== b.length) return false;
  return a.every((card, i) => (card?.userPokemonId ?? null) === (b[i]?.userPokemonId ?? null));
}

function isSlotIndex(index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < DECK_LIMIT;
}
