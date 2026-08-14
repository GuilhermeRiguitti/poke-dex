// ABANDONO POR DESCONEXÃO. Regra pura, com teste.
//
// POR QUE ISTO É ESTADO DE SERVIDOR e não o evento `leave` do WebSocket — são
// três razões independentes, e cada uma sozinha já decide:
//
//  1. O `leave` chega ao BROWSER DO OPONENTE, e declarar vitória é uma ESCRITA.
//     Aceitar o cliente como fonte da verdade é aceitar vitória forjada: bastaria
//     um POST dizendo "ele saiu".
//  2. Quem fecha a aba não envia nada, e se os DOIS saem não há quem observe. A
//     partida viraria zumbi de novo — o problema que o `missedTurns` já existe
//     pra resolver.
//  3. O backstop de verdade é o `pg_cron`, que roda NO BANCO e não tem WebSocket
//     nenhum: ele só sabe ler coluna. Sem `lastSeenAt` persistido, ele não
//     consegue aplicar a regra em partida que ninguém está olhando.
//
// Logo: heartbeat HTTP → coluna → e o Realtime, se um dia entrar, é só sinal pra
// antecipar o request. Nunca a decisão.

/** Fora por mais que isto → o oponente vence. Decisão do dono (2026-08-14). */
export const PRESENCE_TIMEOUT_MS = 60_000;

/**
 * De quanto em quanto o cliente carimba presença.
 *
 * Tem que ser bem menor que o timeout: com 20s, o jogador precisa perder TRÊS
 * batidas seguidas pra ser dado como ausente. Igual ao timeout, um engasgo de
 * rede na hora errada já custaria a partida.
 */
export const PRESENCE_HEARTBEAT_MS = 20_000;

/**
 * Este lado está ausente?
 *
 * `floor` é o piso pra quem NUNCA carimbou (`lastSeenAt` null) — e tem que ser
 * o `createdAt` da PARTIDA, não o `turnStartedAt`. O `turnStartedAt` reseta a
 * cada round: usá-lo daria a todo mundo 60s novos a cada turno resolvido, o que
 * é o oposto do que a regra quer. E sem piso nenhum, `null` viraria "ausente
 * desde a época" e TODA partida nasceria abandonada no primeiro poll.
 */
export function isAbsent(lastSeenAt: Date | null, floor: Date, now: Date): boolean {
  const ultimo = lastSeenAt ?? floor;
  return now.getTime() - ultimo.getTime() > PRESENCE_TIMEOUT_MS;
}

export interface AbsentOutcome {
  finalStatus: "ABANDONED";
  winnerId: string | null;
}

/**
 * O desfecho quando alguém sumiu. `null` = ninguém sumiu, segue o jogo.
 *
 * Os DOIS ausentes → `ABANDONED` sem vencedor, igual ao abandono mútuo por
 * `missedTurns`. Premiar quem "saiu menos" seria inventar um critério que o
 * resto do jogo não tem.
 */
export function absentOutcome(
  a: { userId: string; absent: boolean },
  b: { userId: string; absent: boolean },
): AbsentOutcome | null {
  if (a.absent && b.absent) return { finalStatus: "ABANDONED", winnerId: null };
  if (a.absent) return { finalStatus: "ABANDONED", winnerId: b.userId };
  if (b.absent) return { finalStatus: "ABANDONED", winnerId: a.userId };
  return null;
}

/** Quanto falta pro oponente ausente perder — é o que a tela mostra no aviso. */
export function absenceRemainingMs(lastSeenAt: Date | null, floor: Date, now: Date): number {
  const ultimo = lastSeenAt ?? floor;
  return Math.max(0, PRESENCE_TIMEOUT_MS - (now.getTime() - ultimo.getTime()));
}

/**
 * Limiar da TELA, mais curto que o do encerramento: 2 batidas perdidas.
 *
 * São dois números de propósito. O de encerrar (60s) é a regra do jogo e não
 * pode ser sensível a um engasgo de rede. O de AVISAR precisa vir antes — se a
 * tela só dissesse "desconectado" no instante em que a partida acaba, o aviso
 * não avisaria nada. A diferença entre os dois é a janela em que o jogador vê
 * "vitória em 20s" e ainda pode acontecer de o oponente voltar.
 */
export const PRESENCE_WARN_MS = PRESENCE_HEARTBEAT_MS * 2;

/** Está dando sinal de vida? (limiar da TELA, não o do encerramento) */
export function isPresent(lastSeenAt: Date | null, floor: Date, now: Date): boolean {
  const ultimo = lastSeenAt ?? floor;
  return now.getTime() - ultimo.getTime() <= PRESENCE_WARN_MS;
}
