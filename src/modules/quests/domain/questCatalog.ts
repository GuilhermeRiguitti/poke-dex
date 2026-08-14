// O catálogo de quests diárias. PURO: sem Prisma, sem fetch, sem React.
//
// As quests são a torneira do TUTOR — a 3ª forma de ganhar carta por fora do
// nível (TM e ovo são as outras). Completar uma dá 1 token de tutor, e o token
// ensina um golpe `tutor` a um pokémon que a espécie aprende por tutor.

/** O que o jogo sabe contar. Cada evento é disparado de UM lugar só. */
export type QuestEvent = "battle_played" | "battle_won" | "pack_opened";

export interface QuestDef {
  id: string;
  event: QuestEvent;
  goal: number;
  label: string;
}

/**
 * O catálogo inteiro. `id` é a chave gravada em `QuestProgress` — **nunca mude
 * um id existente**: o progresso do dia está amarrado a ele, e renomear zeraria
 * a barra de quem estava no meio.
 */
export const QUEST_CATALOG: readonly QuestDef[] = [
  { id: "play-2", event: "battle_played", goal: 2, label: "Dispute 2 batalhas" },
  { id: "win-1", event: "battle_won", goal: 1, label: "Vença 1 batalha" },
  { id: "win-3", event: "battle_won", goal: 3, label: "Vença 3 batalhas" },
  { id: "pack-1", event: "pack_opened", goal: 1, label: "Abra 1 pacote" },
  { id: "play-5", event: "battle_played", goal: 5, label: "Dispute 5 batalhas" },
] as const;

/** Quantas quests ficam ativas por dia. */
export const DAILY_QUEST_COUNT = 3;

/**
 * As quests de um dia. A rotação é **determinística** a partir do `dayIndex` —
 * nada de sorteio.
 *
 * Não é preguiça: sem worker, ninguém "gira as quests à meia-noite". Se a
 * escolha fosse sorteada e guardada no primeiro acesso do dia, o jogador que
 * abrisse o app em duas abas ao mesmo tempo poderia receber listas diferentes, e
 * a corrida entre elas decidiria qual valia. Derivar do dia faz todo mundo — as
 * duas abas, o servidor e o `pg_cron` — chegar na mesma lista sem combinar nada.
 */
export function questsForDay(dayIndex: number): QuestDef[] {
  const total = QUEST_CATALOG.length;
  const escolhidas: QuestDef[] = [];
  for (let i = 0; i < Math.min(DAILY_QUEST_COUNT, total); i++) {
    // O passo é (dayIndex + i) porque um deslocamento simples repetiria a mesma
    // combinação todo dia se DAILY_QUEST_COUNT dividisse o catálogo.
    escolhidas.push(QUEST_CATALOG[(dayIndex + i) % total]);
  }
  return escolhidas;
}

export function questById(id: string): QuestDef | null {
  return QUEST_CATALOG.find((q) => q.id === id) ?? null;
}

export function isComplete(progress: number, goal: number): boolean {
  return progress >= goal;
}
