// Regras do streak de login. PURAS: sem Prisma, sem fetch, sem React.
//
// A fronteira do dia (dia UTC) saiu daqui em 2026-08-14 pra `lib/utcDay.ts`,
// quando o cruzamento e as quests passaram a precisar da MESMA fronteira: como
// `domain/` só importa a si mesmo, `pokemon` não pode puxar este arquivo, e
// copiar a conta em cada módulo é o erro caro — bastaria uma cópia divergir pra
// o jogador ganhar duas recompensas na virada. O trade-off do UTC continua o
// mesmo, e está explicado lá.

import { isSameUtcDay, utcDayIndex } from "@/src/lib/utcDay";

export { startOfUtcDay } from "@/src/lib/utcDay";

/** A cada 7 dias seguidos, o jogador ganha 1 pacote-bônus. */
export const STREAK_REWARD_CYCLE = 7;

/** O jogador já fez check-in hoje? (mesmo dia UTC do último check-in) */
export function alreadyCheckedInToday(lastCheckIn: Date | null, now: Date): boolean {
  return lastCheckIn !== null && isSameUtcDay(lastCheckIn, now);
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
