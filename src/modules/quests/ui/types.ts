// Contrato servidor → UI das quests. São `interface`, não pesam no bundle.

export interface QuestDTO {
  questId: string;
  label: string;
  goal: number;
  /** Já limitado ao `goal` — a tela não desenha 5/3. */
  progress: number;
  completed: boolean;
  claimed: boolean;
}

export interface QuestBoardDTO {
  quests: QuestDTO[];
  /** Saldo de tokens de tutor, que é o que as quests pagam. */
  tutorTokens: number;
}
