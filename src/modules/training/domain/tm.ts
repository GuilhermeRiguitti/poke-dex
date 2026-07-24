// Regras do TM (Máquina Técnica). PURAS: sem Prisma, sem fetch, sem React.
//
// O TM ensina um golpe de MÁQUINA que a espécie conhece, gastando 1 token. É a
// primeira forma de ganhar carta por fora do nível (PLANO_JOGO §7.1); tutor e
// ovo vêm depois, gravando na mesma UserPokemonMove só com outro `source`.

/** `source` gravado em UserPokemonMove quando o desbloqueio veio de um TM. */
export const TM_SOURCE = "machine";

/** O método de aprendizado que um TM cobre (o mesmo nome que a PokéAPI usa). */
export const TM_LEARN_METHOD = "machine";

export type TmTeachCheck = "ok" | "not_machine_move" | "already_known";

/**
 * Pode ensinar este golpe por TM? Decisão pura, antes de gastar token.
 *
 * @param learnMethodForMove como a ESPÉCIE aprende o golpe (`PokemonMove.learnMethod`),
 *        ou null se a espécie não conhece o golpe.
 * @param alreadyGranted o golpe já foi concedido a este Pokémon?
 *
 * - Só golpe de `machine` é ensinável por TM. `null` (espécie não conhece) e
 *   `level-up`/`egg`/`tutor` caem em `not_machine_move` — ensinar um level-up por
 *   TM fingiria progressão que o nível ainda não deu; os outros métodos têm a
 *   própria forma de ganhar.
 * - Já concedido → `already_known` (não faz sentido gastar token de novo; o
 *   command usa isso pra NÃO cobrar).
 */
export function checkTmTeachable(
  learnMethodForMove: string | null,
  alreadyGranted: boolean,
): TmTeachCheck {
  if (learnMethodForMove !== TM_LEARN_METHOD) return "not_machine_move";
  if (alreadyGranted) return "already_known";
  return "ok";
}
