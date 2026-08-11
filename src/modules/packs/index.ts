// API pública do módulo packs — as rotas em app/api/** e as pages de (game) só
// devem importar daqui, nunca de domain/queries/commands direto.
//
// Só código de SERVIDOR. Componentes ficam em ui/ e são importados pelas pages
// por caminho direto: um "use client" reexportado por este barrel arrastaria a
// UI (e libs pesadas) pra toda rota de API que importa um command.

// Os DTOs e as constantes do sorteio/cooldown não saem daqui: quem os usa é a
// UI e o próprio módulo, por caminho relativo. `RarityTier` também não — BST e
// raridade são fato da espécie e moram no @/src/modules/pokemon. O que é do
// pacote é o SORTEIO (domain/draw.ts).

// Queries SÓ LEITURA — podem ser chamadas do render de uma page.
export { readPackState } from "./queries/readPackState";
export { readTmTokens } from "./queries/readTmTokens";

// Commands — ESCREVEM. Só rota de API ou Server Action.
export { openPack } from "./commands/openPack";
export { checkInLogin } from "./commands/checkInLogin";
