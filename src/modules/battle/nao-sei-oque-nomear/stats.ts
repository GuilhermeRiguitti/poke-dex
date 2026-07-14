// Fórmula padrão de stat do jogo (IV/EV neutros): usada pra converter os
// base stats da PokéAPI num valor de batalha, fixando o nível de todo mundo
// em BATTLE_LEVEL pra manter os times equilibrados por base stat.
//
// O QUE VEM DA POKÉAPI: só o "base" (base_stat de cada stat, ex: HP base do
// Charizard = 78). É o número fixo por espécie que a API devolve.
//
// O QUE É NOSSO/INVENTADO:
//  - BATTLE_LEVEL = 50 fixo pra TODOS os pokémon, sempre. No jogo real cada
//    pokémon pode ter nível diferente (1-100); aqui isso não existe, é uma
//    escolha de design pra comparar times só pelos base stats.
//  - IV (Individual Values, 0-31 no jogo real) e EV (Effort Values, treino)
//    não existem nesse sistema — as fórmulas abaixo assumem eles neutros/zero.
//    Ou seja: dois "Pikachu" nesse sistema são SEMPRE idênticos em stats.
//  - Não há natureza (nature) alterando stats pra cima/baixo.
// As fórmulas em si (calcHp/calcStat) são a fórmula oficial de Pokémon, só
// que aplicadas com esses valores fixos.

export const BATTLE_LEVEL = 50;

export function calcHp(base: number, level: number = BATTLE_LEVEL): number {
  return Math.floor((2 * base * level) / 100) + level + 10;
}

export function calcStat(base: number, level: number = BATTLE_LEVEL): number {
  return Math.floor((2 * base * level) / 100) + 5;
}
