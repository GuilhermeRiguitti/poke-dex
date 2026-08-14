import "server-only";

// API pública do módulo `quests` — os objetivos DIÁRIOS, que são a torneira do
// token de TUTOR (a 3ª forma de ganhar carta por fora do nível; TM e ovo são as
// outras).
//
// A ideia que sustenta o módulo: as quests do dia são **derivadas** do índice do
// dia UTC por função pura, e o banco guarda só o PROGRESSO. Não há worker pra
// "virar as quests à meia-noite" (CLAUDE.md consequência #1), então qualquer
// desenho que precisasse criar/zerar linhas na virada não funcionaria aqui.
//
// Só código de SERVIDOR. Componentes ficam em ui/ e são importados por caminho
// direto pelas pages.

// ─── leitura ───────────────────────────────────────────────────────────────
export { readDailyQuests } from "./queries/readDailyQuests";

// ─── escrita ───────────────────────────────────────────────────────────────
// `trackBattleFinished` RECEBE O `tx` e roda dentro da transação de quem chama
// (o commit do resolveTurn) — fora dela, o polling de 2s pagaria a quest a cada
// leitura. Mesma forma e mesmo motivo do `grantXp`.
export { trackQuestEvent, trackBattleFinished } from "./commands/trackQuestEvent";
export type { QuestEvent } from "./domain/questCatalog";
// `claimQuestReward` abre a PRÓPRIA transação (é disparada por uma rota).
export { claimQuestReward } from "./commands/claimQuestReward";
export type { ClaimQuestRewardInput } from "./commands/claimQuestReward";
