// ENERGIA POR RODADA. Regra pura, com teste.
//
// A tensão que ela introduz é "descarrego agora ou guardo?": o golpe forte custa
// mais do que a rodada devolve, então usá-lo duas vezes seguidas é impossível e
// escolher QUANDO usá-lo vira decisão. Sem isso, a barra de cartas é sempre
// "aperte a mais forte que tenha PP".
//
// ⚠️ ESTE ARQUIVO É A ALAVANCA DE BALANCEAMENTO. Custo × poder só se acerta
// jogando, e mexer aqui é como se muda o jogo — nada disso vai pro banco, porque
// ninguém filtra nem ordena por custo (CLAUDE.md regra 3.1). Guardar o custo em
// coluna obrigaria a re-sincronizar o espelho a cada ajuste de balanceamento.

import type { BattleMoveDef } from "./types";

/** Com quanta energia cada lado entra na partida. */
export const ENERGY_START = 3;

/** Quanto volta no começo de cada rodada normal. */
export const ENERGY_PER_ROUND = 1;

/** Teto do acúmulo. Sem teto, quem trocasse muito juntaria energia infinita. */
export const ENERGY_MAX = 6;

/**
 * As faixas de custo por poder da carta.
 *
 * **O custo mínimo é 1 e o regen é 1 por rodada** — juntos, eles garantem que
 * SEMPRE existe uma jogada possível. Sem esse piso, um lado poderia ficar sem
 * ação nenhuma e perder por abandono sem ter errado nada, que é exatamente o
 * buraco que o STRUGGLE fecha no PP.
 */
export const ENERGY_COST_BANDS: readonly { maxPower: number; cost: number }[] = [
  { maxPower: 60, cost: 1 },
  { maxPower: 90, cost: 2 },
  { maxPower: Infinity, cost: 3 },
] as const;

/**
 * Quanto custa jogar esta carta.
 *
 * Carta de STATUS (sem dano) custa o mínimo, mesmo sendo forte no efeito: quem
 * usa status já paga o preço de não causar dano naquele turno, e cobrar caro por
 * cima tiraria do jogo a única alternativa de quem está sem energia pro golpe
 * grande.
 */
export function energyCostOf(move: Pick<BattleMoveDef, "power" | "damageClass">): number {
  if (move.damageClass === "status" || move.power === null || move.power <= 0) {
    return ENERGY_COST_BANDS[0].cost;
  }
  const band = ENERGY_COST_BANDS.find((b) => move.power! <= b.maxPower);
  return band?.cost ?? ENERGY_COST_BANDS[ENERGY_COST_BANDS.length - 1].cost;
}

export function regenEnergy(current: number): number {
  return Math.min(ENERGY_MAX, current + ENERGY_PER_ROUND);
}

export function canAfford(energy: number, cost: number): boolean {
  return energy >= cost;
}

/**
 * Os índices das cartas que dá pra pagar AGORA — considerando também o PP, que é
 * o outro limitador.
 *
 * Existe pra o motor distinguir dois casos que parecem iguais e não são: "essa
 * carta é cara mas há outra pagável" (jogada inválida → hesita) de "nenhuma é
 * pagável" (→ struggle). Sem a distinção, ficar sem energia viraria derrota por
 * abandono.
 */
export function affordableSlots(moves: BattleMoveDef[], energy: number): number[] {
  const slots: number[] = [];
  moves.forEach((m, i) => {
    if (m.currentPp > 0 && canAfford(energy, energyCostOf(m))) slots.push(i);
  });
  return slots;
}

/** Alguma carta é pagável agora? */
export function hasAffordableCard(moves: BattleMoveDef[], energy: number): boolean {
  return affordableSlots(moves, energy).length > 0;
}
