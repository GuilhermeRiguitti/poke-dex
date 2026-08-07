// A validação do time que vai ser GRAVADO. Pura: sem Prisma, sem fetch, sem
// React — de propósito, porque ela roda nos DOIS lados.
//
// ── Uma função, dois usos ──────────────────────────────────────────────────
// - No CLIENTE (DeckEditorProvider): decide se o botão "salvar" pode ser
//   apertado e qual aviso mostrar, antes de gastar um request.
// - No SERVIDOR (commands/saveDeck): é a trava de verdade. O corpo do PUT vem
//   da rede — pode chegar com 9 pokémon, com a mesma carta duas vezes, com
//   `order: 99` ou com `userPokemonId: null`, e nada disso passa por aqui.
//
// Escrever a mesma regra duas vezes é como as duas versões se separam. Esta
// recebe `unknown` justamente pra poder ser a validação do corpo do request:
// quem chama não precisa ter narrowed nada antes.
//
// O que ela NÃO cobre (e não tem como): se o pokémon é MESMO do jogador e se
// ele tem ao menos uma skill liberada. As duas dependem do banco e vivem no
// command — o servidor checa ambas antes de gravar.

import { DECK_LIMIT } from "./rules";

/** Uma vaga como ela viaja pro servidor: quem, e em que posição. */
export interface DeckSlotInput {
  userPokemonId: string;
  /** posição no time, 0..DECK_LIMIT-1. A 0 começa em campo. */
  order: number;
}

export type DeckSlotsIssue =
  /** o corpo não é uma lista de { userPokemonId, order } */
  | "malformed"
  /** mais vagas do que o time comporta */
  | "too_many"
  /** o mesmo pokémon em duas vagas */
  | "duplicate_pokemon"
  /** duas cartas na mesma posição */
  | "duplicate_order"
  /** posição fora de 0..DECK_LIMIT-1 */
  | "bad_order";

export type ValidateDeckSlotsResult =
  | { ok: true; slots: DeckSlotInput[] }
  | { ok: false; issue: DeckSlotsIssue };

/**
 * Valida (e tipa) o time que se quer gravar.
 *
 * Time VAZIO passa: esvaziar o deck é uma edição legítima — é como se desmonta
 * o time pra montar outro. Quem barra entrar em batalha sem pokémon é o
 * matchmaking (`enqueueBattle` → `empty_deck`), não o salvar.
 */
export function validateDeckSlots(input: unknown): ValidateDeckSlotsResult {
  if (!Array.isArray(input)) return { ok: false, issue: "malformed" };

  // Antes de qualquer outra coisa: uma lista gigante não vira 6 vagas por
  // acidente. Checar o tamanho primeiro também evita percorrer um array enorme
  // que veio de fora.
  if (input.length > DECK_LIMIT) return { ok: false, issue: "too_many" };

  const slots: DeckSlotInput[] = [];
  const pokemons = new Set<string>();
  const orders = new Set<number>();

  for (const raw of input) {
    if (typeof raw !== "object" || raw === null) return { ok: false, issue: "malformed" };

    const { userPokemonId, order } = raw as { userPokemonId?: unknown; order?: unknown };
    if (typeof userPokemonId !== "string" || userPokemonId === "") {
      return { ok: false, issue: "malformed" };
    }
    if (typeof order !== "number" || !Number.isInteger(order)) {
      return { ok: false, issue: "malformed" };
    }

    // A posição é o que vai pro @@unique([deckId, order]) — fora da faixa o
    // banco aceitaria e o deck ficaria com uma carta que nenhuma tela desenha.
    if (order < 0 || order >= DECK_LIMIT) return { ok: false, issue: "bad_order" };

    // O mesmo pokémon em duas vagas bateria no @@unique([deckId, userPokemonId])
    // no meio do createMany — erro 500 em vez de um aviso legível.
    if (pokemons.has(userPokemonId)) return { ok: false, issue: "duplicate_pokemon" };
    if (orders.has(order)) return { ok: false, issue: "duplicate_order" };

    pokemons.add(userPokemonId);
    orders.add(order);
    slots.push({ userPokemonId, order });
  }

  return { ok: true, slots };
}

/** O aviso que a tela mostra pra cada recusa. */
export function deckSlotsIssueMessage(issue: DeckSlotsIssue): string {
  switch (issue) {
    case "too_many":
      return `O time tem no máximo ${DECK_LIMIT} pokémons`;
    case "duplicate_pokemon":
      return "O mesmo pokémon não pode ocupar duas vagas";
    case "duplicate_order":
      return "Duas cartas na mesma vaga";
    case "bad_order":
      return `As vagas vão de 1 a ${DECK_LIMIT}`;
    case "malformed":
      return "Não deu pra entender o time";
  }
}
