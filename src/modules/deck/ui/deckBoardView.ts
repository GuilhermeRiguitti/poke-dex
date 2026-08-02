// Mapear DTO -> o que a tela desenha é função pura, mora aqui e tem teste.
// Componente é costura. (CLAUDE.md, regra 4 — ver battle/ui/battleView.ts.)

import type { RarityTier } from "@/src/modules/packs/domain/rarity";
import type { BaseStats } from "@/src/modules/progression/domain/leveling";
// Do ui/ do pokedex, não do barrel: `dexNumber` é uma formatação pura da
// identidade do pokémon, e ela é do pokedex. Duplicar aqui seria duas verdades
// pro mesmo "#0025".
import { dexNumber } from "@/src/modules/pokedex/ui/pokedexView";

import { DECK_LIMIT } from "../domain/rules";
import type { DeckBoardDTO } from "./types";

/** Uma vaga do deck. Preenchida, é uma carta mini; vazia, é a moldura tracejada. */
export interface DeckSlotView {
  /** id do DeckSlot, pro X de tirar do deck. null quando a vaga está vazia. */
  id: string | null;
  /** null = vaga vazia (e aí todo o resto também é null) */
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
  /** sempre DECK_LIMIT vagas, na ordem — as vazias vêm com pokemonId null */
  slots: DeckSlotView[];
  /** quantas vagas estão ocupadas */
  count: number;
  limit: number;
  /** o time bateu o limite — é o que faz o botão de batalhar pulsar */
  full: boolean;
  /** o que o botão de batalhar escreve, conforme o time enche */
  battleLabel: string;
}

const VAGA_VAZIA: DeckSlotView = {
  id: null,
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

/**
 * O tabuleiro do deck: sempre DECK_LIMIT vagas, na ordem, com as vazias no fim.
 *
 * Completar até o limite é decisão de APRESENTAÇÃO (a fileira precisa ter
 * sempre o mesmo tamanho, senão ela dança de largura conforme o time cresce) —
 * por isso mora aqui, e não na query.
 */
export function deckBoardView(board: DeckBoardDTO): DeckBoardView {
  const slots = Array.from({ length: DECK_LIMIT }, (_, i) => {
    const slot = board.slots[i];
    if (!slot) return VAGA_VAZIA;

    return {
      id: slot.id,
      pokemonId: slot.pokemonId,
      dexNumber: dexNumber(slot.pokemonId),
      name: slot.name,
      iconUrl: slot.iconUrl,
      level: slot.level,
      types: slot.types,
      accentType: slot.types[0] ?? "normal",
      rarity: slot.rarity,
      baseStats: slot.baseStats,
    };
  });

  // `board.slots` pode vir com mais que o limite (o SLICE é aqui, na
  // apresentação) — contar por ele mentiria "7/6". Conta as vagas desenhadas.
  const count = slots.filter((s) => s.pokemonId !== null).length;
  const full = count >= DECK_LIMIT;

  return {
    slots,
    count,
    limit: DECK_LIMIT,
    full,
    battleLabel: count === 0 ? "Deck vazio" : full ? "Batalhar agora" : `Batalhar · ${count}`,
  };
}

// ─── A conta do arrastar (regra 4: a lógica sai do componente e tem teste) ───

/**
 * Em qual vaga a carta cai: quantas OUTRAS linhas ela já ultrapassou.
 *
 * Compara centro com centro, não com a borda: encostar na linha de baixo não
 * empurra ninguém, a troca só acontece quando a carta passa da metade dela — é
 * onde a intenção fica clara e é o que impede a ordem de tremer enquanto o dedo
 * anda.
 *
 * O meio da PRÓPRIA carta (`from`) fica de fora da conta. Incluir ele fazia a
 * carta trocar de vaga assim que andava um pixel: o centro dela passa do
 * próprio meio imediatamente. Por isso a posição é medida contra as vizinhas.
 *
 * `midpoints` vem medido do DOM, na ordem da tela; `draggedCenter` é o meio da
 * linha arrastada mais o quanto o dedo andou. O resultado fica preso na lista —
 * arrastar pra fora do painel cai na primeira ou na última vaga.
 */
export function dropTargetIndex(midpoints: number[], from: number, draggedCenter: number): number {
  if (midpoints.length === 0) return 0;

  let vaga = 0;
  for (let i = 0; i < midpoints.length; i++) {
    if (i !== from && midpoints[i] < draggedCenter) vaga++;
  }
  return Math.min(vaga, midpoints.length - 1);
}

/**
 * Pra que lado a linha `index` desliza enquanto a carta de `from` está sendo
 * arrastada até `to`: -1 sobe uma vaga, 1 desce uma, 0 fica parada.
 *
 * É o "abrir espaço" da animação. Quem está sendo arrastado (`index === from`)
 * segue o dedo e não entra nesta conta.
 */
/**
 * A posição que a linha `index` MOSTRA durante o arrasto — o destino dela, não
 * de onde saiu.
 *
 * O número da vaga é o que diz quem começa em campo (a 1). Deixá-lo preso ao
 * índice antigo enquanto as cartas deslizam mostra a lista dizendo uma coisa e
 * os números outra: a carta no topo marcada "2". Aqui o número anda junto, e
 * soltar não muda mais nada na tela.
 */
export function livePosition(index: number, from: number, to: number): number {
  if (index === from) return to;
  return index + slotShift(index, from, to);
}

export function slotShift(index: number, from: number, to: number): -1 | 0 | 1 {
  if (index === from) return 0;
  // Descendo: quem está entre a vaga antiga e a nova sobe uma posição.
  if (from < to) return index > from && index <= to ? -1 : 0;
  // Subindo: desce uma.
  if (from > to) return index >= to && index < from ? 1 : 0;
  return 0;
}
