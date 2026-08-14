// A fronteira do DIA no jogo. Infra compartilhada, não regra de negócio: quem
// decide o que acontece na virada é cada módulo.
//
// Mora em `lib/` porque TRÊS módulos precisam da mesma fronteira — `packs` (o
// check-in diário), `pokemon` (um cruzamento por dia) e `quests` (o progresso
// diário) — e `domain/` só pode importar a si mesmo (CLAUDE.md): `pokemon` não
// pode puxar `packs/domain/streak`. A alternativa seria copiar a conta em cada
// um, e duplicar a fronteira do dia é o erro caro: bastaria uma cópia divergir
// pra o jogador ganhar duas recompensas na virada, ou nenhuma.
//
// "Dia" é o dia UTC, não o fuso do jogador: o servidor não sabe o fuso de forma
// confiável, e UTC é determinístico. Quem está perto da meia-noite vê o dia
// virar "cedo/tarde" pelo relógio dele — trade-off consciente, documentado no
// PACK_SYSTEM.md.

const DAY_MS = 86_400_000;

/** Índice do dia UTC (dias inteiros desde a época). Meia-noite UTC = fronteira. */
export function utcDayIndex(d: Date): number {
  return Math.floor(d.getTime() / DAY_MS);
}

/** Meia-noite UTC do dia de `now` — o corte pra "já aconteceu hoje". */
export function startOfUtcDay(now: Date): Date {
  return new Date(utcDayIndex(now) * DAY_MS);
}

/** Os dois instantes caem no mesmo dia UTC? */
export function isSameUtcDay(a: Date, b: Date): boolean {
  return utcDayIndex(a) === utcDayIndex(b);
}
