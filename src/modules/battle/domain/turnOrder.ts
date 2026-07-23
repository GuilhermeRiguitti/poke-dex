import type { BattleMoveDef, BattlePokemonState } from "./types";

// Ordem DENTRO do turno simultâneo — a regra da série, nesta ordem:
//
//   1. PRIORITY do golpe escolhido (quick-attack tem +1 e sai na frente de
//      qualquer coisa, não importa o Speed). O dado é real: vem do campo
//      `priority` do endpoint /move da PokéAPI, já espelhado em Move.
//   2. SPEED efetivo do pokémon (que deriva do nível — deriveStats).
//   3. Empate total: sorteio (é assim no jogo — "speed tie").
//
// É aqui que o Speed volta a ser o que ele é na série. No modelo alternado o
// Speed decidia "quem começa a rodada", o que é outra coisa: quem jogava em
// segundo escolhia JÁ SABENDO a jogada do outro. Aqui os dois escolhem às
// cegas e o Speed decide só quem executa primeiro — que é o ponto em que ele
// importa de verdade (bater antes de tomar).
//
// Puro e determinístico dado o rng (injetado): o mesmo estado + a mesma
// sequência de rng dá sempre a mesma ordem.

/** Prioridade efetiva de uma jogada. Quem não age fica atrás de todo mundo. */
function effectivePriority(mon: BattlePokemonState, cardSlot: number | null): number {
  if (cardSlot === null) return -Infinity; // hesitou: não disputa ordem
  const card: BattleMoveDef | undefined = mon.moves[cardSlot];
  return card?.priority ?? 0;
}

export interface OrderInput {
  userId: string;
  mon: BattlePokemonState;
  /** slot da carta escolhida, ou null se o lado não agiu. */
  cardSlot: number | null;
}

/**
 * Quem age primeiro no turno: devolve [primeiro, segundo] (os mesmos objetos
 * recebidos, não cópias). `rng` só é consumido no empate total — um teste pode
 * passar um rng que lança pra provar que não houve sorteio escondido.
 */
export function orderForTurn(a: OrderInput, b: OrderInput, rng: () => number): [OrderInput, OrderInput] {
  const prioA = effectivePriority(a.mon, a.cardSlot);
  const prioB = effectivePriority(b.mon, b.cardSlot);
  if (prioA !== prioB) return prioA > prioB ? [a, b] : [b, a];

  const speedA = a.mon.stats.speed;
  const speedB = b.mon.stats.speed;
  if (speedA !== speedB) return speedA > speedB ? [a, b] : [b, a];

  return rng() < 0.5 ? [a, b] : [b, a];
}
