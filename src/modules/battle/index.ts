// API pública do module battle — as rotas em app/api/battle/** e as pages de
// (game)/battle/** só devem importar daqui, nunca de domain/queries/commands
// diretamente.
//
// Só entra aqui código de SERVIDOR. Os componentes ficam em ui/ e são
// importados pelas pages por caminho direto, de propósito: se um componente
// "use client" fosse reexportado por este barrel, toda rota de API que
// importa getBattleState arrastaria a UI (e as libs 3D) junto.
//
// Os tipos do motor e os DTOs também não saem daqui: quem os usa é a própria
// mesa (ui/), que importa de ui/types por caminho relativo, e as rotas só fazem
// NextResponse.json do que a query devolve — nenhuma delas anota o tipo.

// getBattleState RESOLVE o turno (escreve, e pode bater na PokéAPI) — é o que
// as rotas de API usam. readBattleState só LÊ — é o que o render das pages
// usa. A diferença importa: ver o comentário em readBattleState.ts.
export { getBattleState } from "./queries/getBattleState";
export { readBattleState } from "./queries/readBattleState";
export { getBattleStatus } from "./queries/getBattleStatus";
export { getQueueStatus } from "./queries/getQueueStatus";
export { getQueueDeck } from "./queries/getQueueDeck";
// As skills que EU posso montar num pokémon do meu time. Rota própria pra não
// pendurar o learnset no BattleDTO, que leva os DOIS lados.
export { getLoadoutOptions } from "./queries/getLoadoutOptions";

export { submitAction } from "./commands/submitAction";
export type { SubmitActionInput } from "./commands/submitAction";
export { enqueueBattle } from "./commands/enqueueBattle";
export { leaveQueue } from "./commands/leaveQueue";

// Motor de servidor: o pg_cron do Supabase dispara a rota que chama isto pra
// resolver turnos vencidos sem depender do polling do cliente (CLAUDE.md consequência #1).
export { resolveDueBattles } from "./commands/resolveDueBattles";
