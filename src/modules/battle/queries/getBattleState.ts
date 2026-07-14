import { loadBattleForResolve, resolveIfDue } from "../commands/resolveTurn";
import { isParticipant } from "./battleAccess";
import { toBattleDTO } from "./toBattleDTO";

// Estado completo da partida (times dos dois lados), já no formato que a UI
// consome. Resolve o turno antes de devolver: não há worker/cron, então ler a
// partida é o que "empurra" a resolução quando os dois lados já jogaram ou o
// timeout estourou.
//
// A ordem aqui é a regra: LÊ -> AUTORIZA -> só então ESCREVE. resolveIfDue
// escreve e pode bater na PokéAPI; autorizar depois dele devolvia o 403 certo,
// mas só depois do estrago. E autorizar não custa uma query extra porque
// reaproveita a leitura que a resolução já ia fazer de qualquer jeito.
//
// Serve tanto a GET /api/battle/[id] quanto o render server-side da página da
// sala — os dois entregam exatamente o mesmo DTO porque passam por aqui.
export async function getBattleState(battleId: string, userId: string) {
  const battle = await loadBattleForResolve(battleId);
  if (!battle) return { error: "not_found" as const };
  if (!isParticipant(battle, userId)) return { error: "forbidden" as const };

  // resolveIfDue relê a partida depois da transação, e esse re-read é anulável:
  // a partida pode ter sumido no meio (cascade de um usuário deletado, p.ex.).
  const resolved = await resolveIfDue(battle);
  if (!resolved) return { error: "not_found" as const };

  return { battle: toBattleDTO(resolved) };
}
