// O RELÓGIO do turno: quanto tempo cada round dura, quanto já passou e o que o
// tempo perdido custa. Puro — só datas e números, sem Prisma e sem React, o que
// permite testar a regra sem subir banco (CLAUDE.md: "domain/ é puro, não tem
// desculpa").
//
// Mora aqui, e não no resolveTurn, porque os DOIS lados do jogo precisam da
// mesma conta: o servidor pra decidir se o turno venceu, e a tela pra desenhar o
// countdown. Duas cópias da duração seriam duas fontes da verdade — a barra
// mostrando 90s enquanto o servidor corta em 60 é o tipo de mentira que só
// aparece na hora em que o jogador perde o turno.

/** Quanto tempo os dois jogadores têm pra escolher a jogada de um round. */
export const TURN_TIMEOUT_MS = 90_000;

/** Hesitações acumuladas por um lado que encerram a partida por abandono. */
export const MAX_MISSES = 3;

/**
 * Quantas janelas de TURN_TIMEOUT_MS já venceram desde que o turno começou.
 * 0 = ainda dá tempo de jogar.
 *
 * É `floor`, e não booleano, DE PROPÓSITO. O turno só resolve quando alguém faz
 * request (não há worker — CLAUDE.md regra 5), então "estourou o tempo" e
 * "alguém apareceu pra notar" são coisas diferentes. Se os dois fecharam a aba e
 * alguém volta 1h depois, venceram ~40 janelas, não 1: contar só 1 fazia a
 * punição por abandono NÃO ser retroativa (o turno resolvido reseta turnStartedAt).
 */
export function expiredTurnWindows(turnStartedAt: Date, now = Date.now()): number {
  return Math.max(0, Math.floor((now - turnStartedAt.getTime()) / TURN_TIMEOUT_MS));
}

/**
 * Faltas de um lado depois deste turno: escolheu → −1, hesitou → +janelas.
 *
 * Simétrico entre os dois lados, ao contrário do modelo alternado. Uma zumbi
 * (ninguém jogando por muitas janelas) leva OS DOIS a MAX_MISSES, encerrando sem
 * vencedor, que é o desfecho justo.
 */
export function nextMisses(current: number, played: boolean, expiredWindows: number): number {
  if (played) return Math.max(0, current - 1);
  return Math.min(MAX_MISSES, current + Math.max(1, expiredWindows));
}

/**
 * Quanto ainda resta da janela ATUAL, em ms. 0 = o tempo acabou e o round vai
 * resolver no próximo request (o polling do cliente ou o backstop do pg_cron).
 *
 * O teto é a própria janela: `turnStartedAt` no futuro (relógio do banco à
 * frente do da lambda, nem que seja por milissegundos) devolveria mais tempo do
 * que o jogador tem de verdade, e a tela prometeria o que o servidor não honra.
 * Mesma defesa que o `expiredTurnWindows` faz do outro lado.
 */
export function remainingTurnMs(turnStartedAt: Date, now = Date.now()): number {
  const elapsed = now - turnStartedAt.getTime();
  return Math.min(TURN_TIMEOUT_MS, Math.max(0, TURN_TIMEOUT_MS - elapsed));
}
