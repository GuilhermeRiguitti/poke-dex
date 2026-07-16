import { loadBattleForResolve, resolveIfDue } from "../commands/resolveTurn";
import { isParticipant } from "./battleAccess";

// GET /api/battle/[id]/status — polling leve; também é quem "empurra" a
// resolução do turno quando o timeout estoura (não há worker/cron).
//
// Este é O caminho quente: os DOIS jogadores batem aqui a cada 2s enquanto a
// partida corre. Por isso a leitura é UMA só — serve pra autorizar E pra
// resolver o turno. Ver isParticipant.
export async function getBattleStatus(battleId: string, userId: string) {
  const battle = await loadBattleForResolve(battleId);
  if (!battle) return { error: "not_found" as const };
  if (!isParticipant(battle, userId)) return { error: "forbidden" as const };

  const resolved = await resolveIfDue(battle);
  if (!resolved) return { error: "not_found" as const };

  // De quem é a vez, do ponto de vista de quem perguntou. No alternado é isto
  // que a UI precisa saber (mostrar "sua vez" / "vez do oponente"), não mais
  // "quem falta submeter" do modelo simultâneo.
  let waitingOn: "you" | "opponent" | null = null;
  if (resolved.status === "IN_PROGRESS" && resolved.activeUserId) {
    waitingOn = resolved.activeUserId === userId ? "you" : "opponent";
  }

  return {
    status: resolved.status,
    round: resolved.round,
    activeUserId: resolved.activeUserId,
    winnerId: resolved.winnerId,
    waitingOn,
  };
}
