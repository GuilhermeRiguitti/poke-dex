import { tryResolveTurn } from "../commands/resolveTurn";
import { toBattleDTO } from "./toBattleDTO";

// Estado completo da partida (times dos dois lados), já no formato que a UI
// consome. Chama tryResolveTurn (que pode escrever!) antes de devolver: não há
// worker/cron, então ler a partida é o que "empurra" a resolução do turno
// quando os dois lados já jogaram ou o timeout estourou.
//
// Serve tanto a GET /api/battle/[id] quanto o render server-side da página da
// sala — os dois entregam exatamente o mesmo DTO porque passam por aqui.
export async function getBattleState(battleId: string, userId: string) {
  const battle = await tryResolveTurn(battleId);
  if (!battle) return { error: "not_found" as const };

  const isParticipant = battle.participants.some((p) => p.userId === userId);
  if (!isParticipant) return { error: "forbidden" as const };

  return { battle: toBattleDTO(battle) };
}
