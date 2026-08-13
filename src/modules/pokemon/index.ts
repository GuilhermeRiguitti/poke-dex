// API pública do módulo pokemon — o núcleo do jogo: a ESPÉCIE (o espelho da
// PokéAPI) e a CARTA do jogador (UserPokemon), mais tudo que faz ela mudar:
// nível, stats, XP, evolução, learnset e TM.
//
// Existe porque essas regras estavam espalhadas por progression, training,
// pokedex, deck, packs e battle — cada módulo guardava um pedaço do mesmo
// assunto. Ver docs/specs/2026-08-07-pokemon-module-design.md.
//
// Só código de SERVIDOR. Componentes ficam em ui/ e são importados pelas pages
// por caminho direto: um "use client" reexportado daqui arrastaria a UI (e as
// libs pesadas dela) pra toda rota de API que importa uma query.
//
// Rotas e pages importam SÓ daqui. A exceção é ui/, que importa de domain/ por
// caminho relativo — este arquivo reexporta queries/commands, que puxam Prisma,
// e o que está em ui/ vai pro bundle do browser.
//
// AQUI SÓ ENTRA O QUE ALGUÉM DE FORA IMPORTA. Este barrel chegou a reexportar as
// ~40 peças do módulo inteiro, e 24 delas não tinham um único importador: quem
// usa `calcHp`/`levelFromXp` é o próprio `deriveStats` ao lado, e quem os
// exercita é o teste, que importa por caminho fundo. Barrel que anuncia mais do
// que alguém pede não é API, é ruído — some com a resposta pra "o que este
// módulo oferece de verdade". Precisou de um símbolo numa page ou rota? Publique
// a linha então, junto do consumidor que a justifica.

// ─── nível, stats e XP ─────────────────────────────────────────────────────
// Nível incremental + stats derivados 100% da API (CLAUDE.md § O jogo, regra 3).
export {
  STARTING_LEVEL,
  LOSER_XP_SHARE,
  deriveStats,
  xpFromDefeat,
  progressionFromLevel,
} from "./domain/leveling";
export type { BaseStats } from "./domain/leveling";

// ─── learnset ──────────────────────────────────────────────────────────────
// Fiel à série: qual move a espécie aprende, por método e nível.
export { PLAYABLE_LEARN_METHOD } from "./domain/learnset";

// ─── evolução ──────────────────────────────────────────────────────────────
// Por nível: quando evoluir, e em que nível a forma evoluída nasce.
export { birthLevelForSpecies } from "./domain/evolution";

// ─── BST e raridade ────────────────────────────────────────────────────────
// Fatos imutáveis da ESPÉCIE, congelados na importação (syncPokedex). O peso
// do sorteio de pacote NÃO está aqui — é do packs (domain/draw.ts).
export { bstOf, rarityTier, DEX_SIZE } from "./domain/rarity";
export type { RarityTier } from "./domain/rarity";

// ─── DTOs ──────────────────────────────────────────────────────────────────
// O contrato servidor → UI. São `interface`, não pesam no bundle.
export type { PokemonCardDTO, LearnsetMoveDTO } from "./ui/types";

// ─── espelho da PokéAPI (Pokemon/Move/PokemonMove) ─────────────────────────
// syncPokedex é o motor da seed E do refresh; refreshPokedex é o que a rota de
// cron chama. Ambos ESCREVEM — só command/rota, nunca render (CLAUDE.md regra 2).
export { syncPokedex } from "./commands/syncPokedex";
export { refreshPokedex } from "./commands/refreshPokedex";

// ─── leitura da espécie ────────────────────────────────────────────────────
// SÓ LEEM — podem ser chamadas do render de uma page.
export { getPokemonDetail } from "./queries/getPokemonDetail";
// Mapper puro NormalizedPokemon → card. Exposto pro catálogo (pokedex) e pro
// pacote montarem a DTO sem duplicar a whitelist de campos.
export { toPokemonCardDTO } from "./queries/toPokemonDTO";

// ─── golpes de UM pokémon do jogador ───────────────────────────────────────
// O repertório completo (level-up + TM, com o flag de destravado). Consumido
// pelo repertório da coleção e pelo seletor de loadout da batalha.
export { readLearnset } from "./queries/readLearnset";
// Só o CONJUNTO de moveId jogáveis (level-up destravado ∪ concedidos) — é o que
// o submitAction da batalha usa pra validar a escolha.
export { getUnlockedMoveIds } from "./queries/getUnlockedMoveIds";

// ─── treino: ensinar por TM ────────────────────────────────────────────────
// Ganhar carta por FORA do nível (CLAUDE.md § O jogo, regra 2); tutor e ovo
// entram depois, gravando na mesma UserPokemonMove com outro `source`.
// ESCREVE (gasta 1 token) — só rota de API.
export { applyTM } from "./commands/applyTM";
export type { ApplyTmInput } from "./commands/applyTM";

// ─── creditar XP (e evoluir) ───────────────────────────────────────────────
// ESCREVE. Recebe o `tx` de quem chama e roda DENTRO da transação dele — quem
// paga hoje é o fim da partida (battle/commands/resolveTurn.ts). Ver grantXp.ts.
export { grantXp } from "./commands/grantXp";
export type { XpAward } from "./commands/grantXp";
