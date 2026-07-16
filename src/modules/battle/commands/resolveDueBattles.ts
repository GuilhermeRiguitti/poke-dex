import { prisma } from "@/src/lib/prisma";
import { TURN_TIMEOUT_MS, loadBattleForResolve, resolveIfDue } from "./resolveTurn";

// Teto de partidas por varredura. É um cinto de segurança: o pg_net tem timeout
// e a lambda tem teto de duração (CLAUDE.md, regra 5) — uma varredura sem limite
// poderia estourar os dois. As mais antigas primeiro (orderBy turnStartedAt),
// então nenhuma partida vencida fica pra trás indefinidamente entre uma
// invocação e a próxima.
const MAX_BATTLES_PER_SWEEP = 50;

export interface ResolveDueSummary {
  scanned: number; // partidas candidatas varridas nesta passada
  finished: number; // quantas saíram de IN_PROGRESS (turno encerrou a partida)
  errors: number; // quantas lançaram — isoladas, NÃO abortam a varredura
}

/**
 * O "worker que não existe na Vercel Hobby", trazido pelo lado do banco.
 *
 * Resolve turnos VENCIDOS sem depender de nenhum jogador estar com a aba aberta.
 * É o que o `pg_cron` do Supabase dispara (ver `app/api/cron/resolve-turns`).
 * CLAUDE.md, regra 5: sem worker, "o tempo só passa quando alguém olha" — e a
 * partida zumbi (os dois fecharam a aba) ficava IN_PROGRESS pra sempre. Este é
 * o relógio de servidor que faz o tempo passar mesmo sem ninguém olhando.
 *
 * Varre SÓ partidas cujo turno já estourou `TURN_TIMEOUT_MS`: são exatamente as
 * que nenhum request de jogador está mais empurrando. O caminho rápido (o
 * jogador da vez jogou dentro do tempo) continua resolvendo no `submitAction` +
 * polling — o cron só cobre o buraco de quando ninguém está lá.
 *
 * Cada partida resolve ISOLADA: uma que exploda (ex. cascade de um usuário
 * deletado no meio) não derruba a varredura das outras. E `resolveIfDue` já é
 * idempotente e disputado pelo claim otimista — dois ticks do cron se cruzando,
 * ou um tick cruzando com o polling de um jogador, é corrida controlada: quem
 * perde o claim não escreve nada.
 */
export async function resolveDueBattles(now = Date.now()): Promise<ResolveDueSummary> {
  const threshold = new Date(now - TURN_TIMEOUT_MS);

  // Só ids: a partida inteira (participantes, pokémons, pending, logs) é
  // carregada uma por vez, dentro do loop, e só pra quem for mesmo resolver.
  const due = await prisma.battle.findMany({
    where: { status: "IN_PROGRESS", turnStartedAt: { lt: threshold } },
    orderBy: { turnStartedAt: "asc" },
    take: MAX_BATTLES_PER_SWEEP,
    select: { id: true },
  });

  let finished = 0;
  let errors = 0;

  // Sequencial de propósito: conexão é recurso escasso (CLAUDE.md, consequência
  // #3). Abrir 50 transações de uma vez esgotaria o pool do PgBouncer.
  for (const { id } of due) {
    try {
      const battle = await loadBattleForResolve(id);
      if (!battle) continue; // sumiu entre o SELECT e o load (cascade)
      const after = await resolveIfDue(battle);
      if (after && after.status !== "IN_PROGRESS") finished++;
    } catch (err) {
      errors++;
      console.error(`resolveDueBattles: falha ao resolver ${id}:`, err);
    }
  }

  return { scanned: due.length, finished, errors };
}
