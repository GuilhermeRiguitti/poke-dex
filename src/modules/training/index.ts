// API pública do módulo training — ganhar cartas por FORA do nível (PLANO_JOGO
// §7.1). Fatia 1: TM (Máquina Técnica). Tutor e ovo entram nas próximas,
// gravando na mesma UserPokemonMove com outro `source`.
//
// As rotas em app/api/** importam só daqui. Só código de SERVIDOR — componentes
// ficam em ui/ e são importados pelas pages por caminho direto.

export type { TeachTmResponseDTO } from "./ui/types";

// Regra pura do TM (método machine + não concedido). Exposta pro teste e pra
// quem quiser validar antes de chamar o command.
export { checkTmTeachable, TM_SOURCE, TM_LEARN_METHOD } from "./domain/tm";
export type { TmTeachCheck } from "./domain/tm";

// Command — ESCREVE. Só rota de API.
export { applyTM } from "./commands/applyTM";
export type { ApplyTmInput, ApplyTmResult } from "./commands/applyTM";
