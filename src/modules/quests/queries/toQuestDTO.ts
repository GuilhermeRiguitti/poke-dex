// Mapper linha crua → DTO da quest. Whitelist explícita (CLAUDE.md regra 3).
//
// A linha de `QuestProgress` carrega `userId` e `dayIndex`, que são chave
// interna e não dizem nada pra tela. `dayIndex` em especial não pode sair: é o
// índice do dia UTC, e a UI que recebesse isso ficaria tentada a calcular o dia
// no cliente — onde o fuso do browser daria outra resposta que a do servidor.

import { isComplete, type QuestDef } from "../domain/questCatalog";
import type { QuestDTO } from "../ui/types";

export interface QuestProgressRow {
  questId: string;
  progress: number;
  claimedAt: Date | null;
}

export function toQuestDTO(quest: QuestDef, row: QuestProgressRow | undefined): QuestDTO {
  const progress = row?.progress ?? 0;
  return {
    questId: quest.id,
    label: quest.label,
    goal: quest.goal,
    // Limitado ao alvo: o contador do banco pode passar (você venceu 5 numa
    // quest de 3), e "5/3" numa barra de progresso só confunde.
    progress: Math.min(progress, quest.goal),
    completed: isComplete(progress, quest.goal),
    claimed: Boolean(row?.claimedAt),
  };
}
