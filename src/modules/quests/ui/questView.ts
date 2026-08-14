// Regra de APRESENTAÇÃO das quests: DTO → o que a tela desenha. Pura, com teste.

import type { QuestDTO } from "./types";

export interface QuestView {
  questId: string;
  label: string;
  /** "1/3" */
  counter: string;
  /** 0..100, pra largura da barra. */
  percent: number;
  /** O botão só aparece quando há o que resgatar. */
  showClaim: boolean;
  /** Estado visual: em andamento, pronta pra resgatar, ou já resgatada. */
  state: "doing" | "claimable" | "claimed";
}

export function questView(quest: QuestDTO): QuestView {
  const state: QuestView["state"] = quest.claimed
    ? "claimed"
    : quest.completed
      ? "claimable"
      : "doing";

  return {
    questId: quest.questId,
    label: quest.label,
    counter: `${quest.progress}/${quest.goal}`,
    // `goal` nunca é 0 no catálogo, mas dividir por zero aqui daria NaN e a
    // barra sumiria sem erro nenhum — o tipo de falha que só aparece em prod.
    percent: quest.goal > 0 ? Math.round((quest.progress / quest.goal) * 100) : 0,
    showClaim: state === "claimable",
    state,
  };
}

export function questBoardView(quests: QuestDTO[]): QuestView[] {
  return quests.map(questView);
}

/** Quantas ainda dão token — é o que o resumo do topo mostra. */
export function claimableCount(quests: QuestDTO[]): number {
  return quests.filter((q) => q.completed && !q.claimed).length;
}
