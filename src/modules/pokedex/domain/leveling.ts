// Nível incremental + stats derivados 100% da PokéAPI (PLANO_JOGO.md §6).
//
// O QUE VEM DA API: os `baseStats` (o número fixo por espécie) e o
// `baseExperience` (quanto vale derrotar aquela espécie). NADA de stat é
// inventado por nós — o nível é o único multiplicador.
//
// As fórmulas são as da série principal, IV/EV neutros (simplificação da §6):
//   HP     = floor(2 * baseHP * nível / 100) + nível + 10
//   Demais = floor(2 * base   * nível / 100) + 5
//
// O QUE O NÍVEL **NÃO** FAZ (e já fez): multiplicar o poder da skill. Existia
// aqui um `skillPowerMult = 1 + (nível-1)*k` — uma invenção nossa, nunca ligada
// em produção, e que NÃO é como o jogo real funciona. Foi removido. No jogo
// real o nível influencia o dano por dois caminhos, os dois já implementados:
//   1. escala os stats do atacante (deriveStats, aqui embaixo);
//   2. entra direto na fórmula de dano (battle/domain/damage.ts).
// E influencia o REPERTÓRIO: o nível é o que LIBERA moves novos no learnset
// (domain/learnset.ts) — essa é a alavanca de progressão fiel à série.

export const MIN_LEVEL = 1;
export const MAX_LEVEL = 100;

/**
 * Nível em que um pokémon entra na coleção. 1 seria fiel a "ovo", não a
 * captura — e, com o learnset travado por nível, um nv.1 abriria com 1-2 cartas
 * só. 5 é o nível de inicial da série e já dá um leque jogável.
 */
export const STARTING_LEVEL = 5;

/** As 6 base stats como a PokéAPI as devolve (guardadas em Pokemon.baseStats). */
export interface BaseStats {
  hp: number;
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
}

/** Stats de batalha já derivados por nível — o que o motor consome. */
export interface DerivedStats {
  hp: number;
  attack: number;
  defense: number;
  specialAttack: number;
  specialDefense: number;
  speed: number;
}

function clampLevel(level: number): number {
  if (!Number.isFinite(level)) return MIN_LEVEL;
  return Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, Math.floor(level)));
}

/** HP tem fórmula própria (+ nível + 10). */
export function calcHp(baseHp: number, level: number): number {
  const lv = clampLevel(level);
  return Math.floor((2 * baseHp * lv) / 100) + lv + 10;
}

/** Demais stats: fórmula comum (+ 5). */
export function calcStat(base: number, level: number): number {
  const lv = clampLevel(level);
  return Math.floor((2 * base * lv) / 100) + 5;
}

/** base stats + nível → stats de batalha. */
export function deriveStats(base: BaseStats, level: number): DerivedStats {
  return {
    hp: calcHp(base.hp, level),
    attack: calcStat(base.atk, level),
    defense: calcStat(base.def, level),
    specialAttack: calcStat(base.spa, level),
    specialDefense: calcStat(base.spd, level),
    speed: calcStat(base.spe, level),
  };
}

// ─── XP / progressão (curva da série) ─────────────────────────────────────
//
// `UserPokemon.xp` é o XP **TOTAL acumulado** (não o progresso dentro do nível).
// É assim na série, e é o que torna a conta reversível: o nível é uma FUNÇÃO do
// xp total, então não há como o par (level, xp) divergir — não existe estado
// inválido pra reparar, o que importa num ambiente sem worker (CLAUDE.md §5).
//
// Curva: `medium-fast` — total pra chegar no nível n = n³. É a curva mais comum
// da série (~55% das espécies). SIMPLIFICAÇÃO CONSCIENTE: a PokéAPI expõe a
// curva real de cada espécie em /pokemon-species (`growth_rate`, 6 curvas), mas
// isso custa +1 fetch por espécie no seed. Se um dia buscarmos species (pra
// evolução), a curva vem junto e entra aqui — o resto do código só chama
// `levelFromXp`/`xpForLevel`.

/** XP total necessário pra ESTAR no nível n (curva medium-fast: n³). */
export function xpForLevel(level: number): number {
  return Math.pow(clampLevel(level), 3);
}

/** O nível correspondente a um XP total. Inverso de xpForLevel. */
export function levelFromXp(totalXp: number): number {
  const xp = Math.max(0, Math.floor(totalXp));
  // cbrt em float pode devolver 4.999999 pra 125; arredonda e corrige pra baixo.
  const guess = Math.round(Math.cbrt(xp));
  const level = xpForLevel(guess) > xp ? guess - 1 : guess;
  return clampLevel(level);
}

/** Quanto falta, em XP, pro próximo nível. 0 no teto. */
export function xpToNextLevel(totalXp: number): number {
  const level = levelFromXp(totalXp);
  if (level >= MAX_LEVEL) return 0;
  return xpForLevel(level + 1) - Math.max(0, Math.floor(totalXp));
}

/**
 * XP ganho por derrotar um pokémon, fórmula da série (gen 5+, sem os
 * modificadores de item/troca/afeto que não modelamos):
 *
 *   xp = floor(baseExperience_do_derrotado * nível_do_derrotado / 7)
 *
 * `baseExperience` vem da API (Pokemon.baseExperience). Espécie sem o dado
 * (a API devolve null pra algumas formas) cai num default modesto.
 */
export const FALLBACK_BASE_EXPERIENCE = 64;

export function xpFromDefeat(baseExperience: number | null, defeatedLevel: number): number {
  const base = baseExperience && baseExperience > 0 ? baseExperience : FALLBACK_BASE_EXPERIENCE;
  return Math.floor((base * clampLevel(defeatedLevel)) / 7);
}

/**
 * Fatia do XP que o PERDEDOR leva. **Desvio consciente da série** (lá quem é
 * nocauteado não ganha nada): sem isso, quem perde nunca sobe de nível, nunca
 * destrava carta nova e afunda numa espiral — e o learnset por nível vira
 * punição em vez de progressão. Alavanca de balanço; mexer aqui não toca lógica.
 */
export const LOSER_XP_SHARE = 0.25;

export interface Progress {
  level: number;
  /** XP TOTAL acumulado depois do ganho. */
  xp: number;
  /** níveis ganhos nesta aplicação (0 se não subiu). */
  gained: number;
}

/**
 * Soma XP a um total acumulado e diz em que nível isso põe o pokémon. Puro: não
 * toca no banco — o caller persiste. No teto o XP para de acumular.
 */
export function applyXp(totalXp: number, gainedXp: number): Progress {
  const before = levelFromXp(totalXp);
  const capped = xpForLevel(MAX_LEVEL);
  const next = Math.min(capped, Math.max(0, Math.floor(totalXp)) + Math.max(0, Math.floor(gainedXp)));
  const after = levelFromXp(next);
  return { level: after, xp: next, gained: after - before };
}
