// API pública do module battle — as rotas em app/api/battle/** e as pages de
// (game)/battle/** só devem importar daqui, nunca de domain/queries/commands
// diretamente.
//
// Só entra aqui código de SERVIDOR. Os componentes ficam em ui/ e são
// importados pelas pages por caminho direto, de propósito: se um componente
// "use client" fosse reexportado por este barrel, toda rota de API que
// importa getBattleState arrastaria a UI (e o Konva) junto.

export type {
  BattleStats,
  BattleMoveDef,
  BattlePokemonState,
  BattleSideState,
  BattleState,
  BattleAction,
  BattleSideLabel,
  BattleEvent,
} from "./domain/types";

// O contrato de dados que sai daqui pra UI (tipos são apagados na compilação,
// então exportá-los não puxa nada pro bundle).
export type {
  BattleDTO,
  BattleEventDTO,
  BattleMoveDTO,
  BattlePokemonDTO,
  BattleStatusDTO,
  ParticipantDTO,
  QueueDeckDTO,
  TurnLogDTO,
} from "./ui/types";

// getBattleState RESOLVE o turno (escreve, e pode bater na PokéAPI) — é o que
// as rotas de API usam. readBattleState só LÊ — é o que o render das pages
// usa. A diferença importa: ver o comentário em readBattleState.ts.
export { getBattleState } from "./queries/getBattleState";
export { readBattleState } from "./queries/readBattleState";
export { getBattleStatus } from "./queries/getBattleStatus";
export { getQueueStatus } from "./queries/getQueueStatus";
export { getQueueDeck } from "./queries/getQueueDeck";

export { submitMove } from "./commands/submitMove";
export type { SubmitMoveInput } from "./commands/submitMove";
export { enqueueBattle } from "./commands/enqueueBattle";
export { leaveQueue } from "./commands/leaveQueue";
