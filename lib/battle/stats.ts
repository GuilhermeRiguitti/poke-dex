// Fórmula padrão de stat do jogo (IV/EV neutros): usada pra converter os
// base stats da PokéAPI num valor de batalha, fixando o nível de todo mundo
// em BATTLE_LEVEL pra manter os times equilibrados por base stat.

export const BATTLE_LEVEL = 50;

export function calcHp(base: number, level: number = BATTLE_LEVEL): number {
  return Math.floor((2 * base * level) / 100) + level + 10;
}

export function calcStat(base: number, level: number = BATTLE_LEVEL): number {
  return Math.floor((2 * base * level) / 100) + 5;
}
