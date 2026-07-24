// API pública do módulo packs — as rotas em app/api/** e as pages de (game) só
// devem importar daqui, nunca de domain/queries/commands direto.
//
// Só código de SERVIDOR. Componentes ficam em ui/ e são importados pelas pages
// por caminho direto: um "use client" reexportado por este barrel arrastaria a
// UI (e libs pesadas) pra toda rota de API que importa um command.

export type { PackCardDTO, PackStateDTO, OpenPackResultDTO } from "./ui/types";
export type { RarityTier } from "./domain/rarity";
export { PACK_SIZE } from "./domain/rarity";
export { FREE_PACK_INTERVAL_MS } from "./domain/cooldown";

// Queries SÓ LEITURA — podem ser chamadas do render de uma page.
export { readPackState } from "./queries/readPackState";
export { readTmTokens } from "./queries/readTmTokens";

// Commands — ESCREVEM. Só rota de API ou Server Action.
export { openPack } from "./commands/openPack";
export type { OpenPackResult } from "./commands/openPack";
export { checkInLogin } from "./commands/checkInLogin";
export type { CheckInResult } from "./commands/checkInLogin";
