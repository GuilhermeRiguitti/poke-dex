import {
  DEFAULT_GROWTH_RATE,
  levelFromXpOn,
  xpForLevelOn,
  type GrowthRate,
} from "./growthRate";

// Nível incremental + stats derivados 100% da PokéAPI (CLAUDE.md § O jogo, regra 3).
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
 * Nível em que um pokémon entra na coleção. Todo pokémon nasce em nível 1: no
 * jogo real toda espécie já conhece ao menos um move no nível 1, então mesmo
 * com o learnset travado por nível ele abre jogável (com 1+ carta). Subir de
 * nível é o que destrava o resto do leque — é a progressão.
 */
export const STARTING_LEVEL = 1;

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
// CURVA POR ESPÉCIE desde 2026-08-14 (antes era `medium-fast` pra todo mundo).
// As seis fórmulas moram em `growthRate.ts`; aqui ficou só a fachada. O dado
// vem do `growth_rate` de /pokemon-species — endpoint que o sync já chamava pra
// descobrir a cadeia de evolução e cujo resto do payload era descartado.
//
// O parâmetro `rate` é OPCIONAL em todas as funções abaixo, e cai em
// `medium-fast`. Não é preguiça: é o que tornou a mudança aditiva, porque
// medium-fast era a curva única de antes. Quem chamar sem informar a curva
// recebe exatamente os mesmos números de antes.

/**
 * XP total necessário pra ESTAR no nível n, na curva da espécie.
 *
 * `rate` é opcional e cai em `medium-fast` — que era a curva única de todo o
 * jogo até 2026-08-14. É isso que permitiu a mudança ser aditiva: quem chamar
 * sem informar a curva recebe os mesmos números de antes.
 */
export function xpForLevel(level: number, rate: GrowthRate = DEFAULT_GROWTH_RATE): number {
  return xpForLevelOn(rate, clampLevel(level));
}

/** O nível correspondente a um XP total. Inverso de xpForLevel. */
export function levelFromXp(totalXp: number, rate: GrowthRate = DEFAULT_GROWTH_RATE): number {
  return clampLevel(levelFromXpOn(rate, totalXp));
}

/** Quanto falta, em XP, pro próximo nível. 0 no teto. */
export function xpToNextLevel(totalXp: number, rate: GrowthRate = DEFAULT_GROWTH_RATE): number {
  const level = levelFromXp(totalXp, rate);
  if (level >= MAX_LEVEL) return 0;
  return xpForLevel(level + 1, rate) - Math.max(0, Math.floor(totalXp));
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
export function applyXp(
  totalXp: number,
  gainedXp: number,
  rate: GrowthRate = DEFAULT_GROWTH_RATE,
): Progress {
  const before = levelFromXp(totalXp, rate);
  const capped = xpForLevel(MAX_LEVEL, rate);
  const next = Math.min(capped, Math.max(0, Math.floor(totalXp)) + Math.max(0, Math.floor(gainedXp)));
  const after = levelFromXp(next, rate);
  return { level: after, xp: next, gained: after - before };
}

// ─── o par (xp, level) escrito por construção ──────────────────────────────
//
// `level` é função de `xp` (levelFromXp), mas as DUAS são coluna do
// UserPokemon: o banco precisa ORDENAR por nível, e não dá pra ordenar por uma
// conta feita em JS depois da query. Materializar é a escolha certa; o preço é
// que quem escreve uma tem que escrever a outra.
//
// Até aqui isso era garantido por convenção e comentário nos dois escritores
// (openPack e awardBattleXp). Com estes helpers passa a ser por construção: o
// caller monta o `data` com o objeto inteiro e não consegue produzir o par
// inválido. São dois porque os dois escritores andam em sentidos opostos —
// nascimento sabe o NÍVEL, batalha sabe o XP.

/** Soma dos 6 base stats: a "fortitude" da espécie, que define a raridade. */
export function sumBaseStats(base: BaseStats): number {
  return base.hp + base.atk + base.def + base.spa + base.spd + base.spe;
}

/** Par consistente a partir do XP TOTAL acumulado. Nunca lança. */
export function progressionFromXp(
  totalXp: number,
  rate: GrowthRate = DEFAULT_GROWTH_RATE,
): { xp: number; level: number } {
  const xp = Number.isFinite(totalXp) ? Math.max(0, Math.floor(totalXp)) : 0;
  return { xp, level: levelFromXp(xp, rate) };
}

/** Par consistente a partir de um nível de nascimento. Nunca lança. */
export function progressionFromLevel(
  level: number,
  rate: GrowthRate = DEFAULT_GROWTH_RATE,
): { xp: number; level: number } {
  const clamped = clampLevel(level);
  return { xp: xpForLevel(clamped, rate), level: clamped };
}
