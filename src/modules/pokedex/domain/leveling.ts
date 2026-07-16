// Nível incremental + stats derivados 100% da PokéAPI (PLANO_JOGO.md §6).
//
// O QUE VEM DA API: só os `baseStats` (o número fixo por espécie). NADA de stat
// é inventado por nós — o nível é o único multiplicador. Isso remove, no jogo
// novo, o nível 50 fixo e todo stat montado à mão de battle/domain/stats.ts
// (que segue vivo pro jogo atual até a Fase A migrar a batalha).
//
// As fórmulas são as da série principal, IV/EV neutros (simplificação da §6):
//   HP     = floor(2 * baseHP * nível / 100) + nível + 10
//   Demais = floor(2 * base   * nível / 100) + 5
//
// Curva de XP e `SKILL_POWER_K`: são a decisão ABERTA F4 (afinamos jogando).
// Os valores aqui são defaults conscientes e isolados nas constantes abaixo —
// mexer neles é a alavanca de balanço, não precisa tocar em lógica.

export const MIN_LEVEL = 1;
export const MAX_LEVEL = 100;

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

// ─── XP / progressão (F4 — tunável) ───────────────────────────────────────
//
// `xp` no banco é o PROGRESSO dentro do nível atual (reseta ao subir), não o
// total acumulado — mantém o número pequeno e o "quanto falta" é leitura direta.
// Custo pra subir DE `level` PRA `level+1` = XP_PER_LEVEL * level (linear por
// nível → acumulado quadrático). Barato e fácil de afinar.

export const XP_PER_LEVEL = 25;

/** Custo pra ir de `level` → `level+1`. No teto, +∞ (não sobe mais). */
export function xpForNextLevel(level: number): number {
  const lv = clampLevel(level);
  if (lv >= MAX_LEVEL) return Infinity;
  return XP_PER_LEVEL * lv;
}

export interface Progress {
  level: number;
  xp: number;
  /** níveis ganhos nesta aplicação (0 se não subiu). */
  gained: number;
}

/**
 * Aplica XP ganho a um (nível, xp) e sobe de nível o quanto der. Puro: não
 * toca no banco. O caller persiste o resultado. No teto, o excedente de XP é
 * descartado (fica 0) — não há pra onde subir.
 */
export function applyXp(level: number, xp: number, gainedXp: number): Progress {
  let lv = clampLevel(level);
  let acc = Math.max(0, Math.floor(xp)) + Math.max(0, Math.floor(gainedXp));
  const startLevel = lv;

  while (lv < MAX_LEVEL) {
    const need = xpForNextLevel(lv);
    if (acc < need) break;
    acc -= need;
    lv += 1;
  }
  if (lv >= MAX_LEVEL) acc = 0;

  return { level: lv, xp: acc, gained: lv - startLevel };
}

// ─── Multiplicador de poder de skill por nível (F4 — tunável) ─────────────
//
// O nível já escala o dano por escalar o stat do atacante (deriveStats). Este
// é o alavanca EXTRA da §6: fazer a própria skill escalar além do stat.
// skillPowerMult(level) = 1 + (level - 1) * SKILL_POWER_K.

export const SKILL_POWER_K = 0.02;

export function skillPowerMult(level: number, k: number = SKILL_POWER_K): number {
  return 1 + (clampLevel(level) - 1) * k;
}
