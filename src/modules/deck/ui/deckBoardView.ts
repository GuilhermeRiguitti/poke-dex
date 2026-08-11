// Mapear o rascunho -> o que a tela desenha é função pura, mora aqui e tem
// teste. Componente é costura. (CLAUDE.md, regra 4 — ver battle/ui/battleView.ts.)
//
// Mudou de fonte junto com a arquitetura: antes recebia o DeckBoardDTO (o deck
// GRAVADO) e empacotava as vagas cheias no começo da fileira. Agora recebe o
// RASCUNHO, que já é posicional e já tem DECK_LIMIT posições — a vaga 3 é a
// vaga 3, cheia ou vazia, e ninguém é empurrado.
//
// Saíram daqui `dropTargetIndex`, `slotShift` e `livePosition`: eram a conta de
// uma lista que se reordena EMPURRANDO os vizinhos (medir os meios das linhas,
// decidir quem desliza pra que lado). Com vaga como endereço fixo, soltar é
// ocupar ou trocar duas posições — quem sabe onde o ponteiro está é o retângulo
// de cada vaga, no DeckEditorProvider, e não uma conta de deslocamento.

import type { RarityTier } from "@/src/modules/pokemon/domain/rarity";
import type { BaseStats } from "@/src/modules/pokemon/domain/leveling";
// Do ui/ do pokedex, não do barrel: `dexNumber` é uma formatação pura da
// identidade do pokémon, e ela é do pokedex. Duplicar aqui seria duas verdades
// pro mesmo "#0025".
import { dexNumber } from "@/src/modules/pokemon/ui/pokeCardView";

import type { DeckDraft } from "../domain/deckDraft";
import { DECK_LIMIT } from "../domain/rules";
import type { DeckCardDTO } from "./types";

/** Uma vaga do deck. Preenchida, é a linha da carta; vazia, é a moldura tracejada. */
export interface DeckSlotView {
  /** a posição, 0-based. É o ENDEREÇO da vaga, não a ordem de desenho. */
  index: number;
  /** o número que a vaga mostra (1-based) */
  numero: number;
  /** a vaga 0 é quem começa em campo */
  emCampo: boolean;
  /** null = vaga vazia (e aí todo o resto também é null) */
  userPokemonId: string | null;
  pokemonId: number | null;
  dexNumber: string | null;
  name: string | null;
  iconUrl: string | null;
  level: number | null;
  types: string[];
  /** tipo que tinge a linha da vaga. null quando vazia. */
  accentType: string | null;
  rarity: RarityTier | null;
  baseStats: BaseStats | null;
}

export interface DeckBoardView {
  /** sempre DECK_LIMIT vagas, na ordem das posições — as vazias vêm com pokemonId null */
  slots: DeckSlotView[];
  /** quantas vagas estão ocupadas */
  count: number;
  limit: number;
  /** o time bateu o limite — é o que faz o botão de batalhar pulsar */
  full: boolean;
  /** dá pra entrar na fila agora? */
  canBattle: boolean;
  /** o que o botão de batalhar escreve */
  battleLabel: string;
  /** por que não dá pra batalhar (null quando dá) */
  battleBlockedReason: string | null;
}

export interface DeckBoardStatus {
  /** o jogador está mexendo no time */
  editing: boolean;
  /** o rascunho difere do que está gravado */
  dirty: boolean;
}

/**
 * O tabuleiro do deck: DECK_LIMIT vagas, cada uma no seu endereço.
 *
 * O rascunho já vem com o tamanho certo; se vier torto (mais ou menos que
 * DECK_LIMIT), a fileira é normalizada aqui — a coluna não pode dançar de
 * largura conforme o time cresce, e isso é decisão de APRESENTAÇÃO.
 */
export function deckBoardView(
  draft: DeckDraft<DeckCardDTO>,
  status: DeckBoardStatus
): DeckBoardView {
  const slots: DeckSlotView[] = Array.from({ length: DECK_LIMIT }, (_, index) => {
    const base = { index, numero: index + 1, emCampo: index === 0 };
    const card = draft[index] ?? null;

    if (!card) {
      return {
        ...base,
        userPokemonId: null,
        pokemonId: null,
        dexNumber: null,
        name: null,
        iconUrl: null,
        level: null,
        types: [],
        accentType: null,
        rarity: null,
        baseStats: null,
      };
    }

    return {
      ...base,
      userPokemonId: card.userPokemonId,
      pokemonId: card.pokemonId,
      dexNumber: dexNumber(card.pokemonId),
      name: card.name,
      iconUrl: card.iconUrl,
      level: card.level,
      types: card.types,
      accentType: card.types[0] ?? "normal",
      rarity: card.rarity,
      baseStats: card.baseStats,
    };
  });

  // Conta as vagas DESENHADAS, não o rascunho recebido: um rascunho maior que o
  // limite escreveria "8/6" na tela que só mostra 6.
  const count = slots.filter((s) => s.userPokemonId !== null).length;
  const full = count >= DECK_LIMIT;

  // ── A trava da batalha ───────────────────────────────────────────────────
  // Deck EM EDIÇÃO não batalha. Não é capricho de UI: o que a batalha usa é o
  // que está GRAVADO, e a tela estaria mostrando outro time. Entrar na fila
  // vendo seis cartas arrumadas e batalhar com as três antigas é a pior versão
  // disso — o jogador não teria como saber que perdeu por um deck que não é o
  // que ele montou. Ou salva, ou cancela.
  const battleBlockedReason = status.editing
    ? status.dirty
      ? "Salve o time para batalhar"
      : "Termine a edição para batalhar"
    : count === 0
      ? "Monte um time para batalhar"
      : null;

  return {
    slots,
    count,
    limit: DECK_LIMIT,
    full,
    canBattle: battleBlockedReason === null,
    battleLabel: count === 0 ? "Deck vazio" : full ? "Batalhar agora" : `Batalhar · ${count}`,
    battleBlockedReason,
  };
}
