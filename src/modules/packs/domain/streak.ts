// Regras do streak de login. PURAS: sem Prisma, sem fetch, sem React.
//
// "Dia" aqui é o dia UTC (não o fuso do jogador — o servidor não sabe o fuso de
// forma confiável, e UTC é determinístico). Um jogador perto da meia-noite pode
// ver o dia virar "cedo/tarde" pelo relógio dele; é o trade-off consciente por
// simplicidade e reprodutibilidade. Documentado no PACK_SYSTEM.md.

export const DAY_MS = 86_400_000;

/** A cada 7 dias seguidos, o jogador ganha 1 pacote-bônus. */
export const STREAK_REWARD_CYCLE = 7;

/** Índice do dia UTC (dias inteiros desde a época). Meia-noite UTC = fronteira. */
export function utcDayIndex(d: Date): number {
  return Math.floor(d.getTime() / DAY_MS);
}

/** Meia-noite UTC do dia de `now` — o corte pra "já contou hoje". */
export function startOfUtcDay(now: Date): Date {
  return new Date(utcDayIndex(now) * DAY_MS);
}

/** O jogador já fez check-in hoje? (mesmo dia UTC do último check-in) */
export function alreadyCheckedInToday(lastCheckIn: Date | null, now: Date): boolean {
  return lastCheckIn !== null && utcDayIndex(lastCheckIn) === utcDayIndex(now);
}

/**
 * O streak DEPOIS deste check-in.
 *  - nunca fez check-in            → 1
 *  - último foi ontem (delta 1)    → +1 (continua a sequência)
 *  - último foi hoje (delta 0/neg) → mantém (o claim vai no-opar de qualquer jeito)
 *  - pulou ao menos um dia (>=2)   → 1 (reseta)
 */
export function nextStreak(prevStreak: number, lastCheckIn: Date | null, now: Date): number {
  if (!lastCheckIn) return 1;
  const delta = utcDayIndex(now) - utcDayIndex(lastCheckIn);
  if (delta <= 0) return prevStreak;
  if (delta === 1) return prevStreak + 1;
  return 1;
}

/** Este streak fecha um ciclo de recompensa (múltiplo de 7)? */
export function earnsReward(streak: number): boolean {
  return streak > 0 && streak % STREAK_REWARD_CYCLE === 0;
}

/** Quantos dias faltam pro próximo pacote-bônus. Um marco recém-batido → 7. */
export function daysUntilReward(streak: number): number {
  const into = streak % STREAK_REWARD_CYCLE;
  return into === 0 ? STREAK_REWARD_CYCLE : STREAK_REWARD_CYCLE - into;
}
