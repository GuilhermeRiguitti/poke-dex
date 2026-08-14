// Regras do TUTOR. PURAS: sem Prisma, sem fetch, sem React.
//
// O tutor ensina um golpe que a espécie aprende por `tutor`, gastando 1 token de
// TUTOR — que vem de completar quest diária (módulo `quests`), não do check-in.
// É a 3ª forma de ganhar carta por fora do nível; TM e ovo são as outras, e as
// três gravam na MESMA `UserPokemonMove`, só com `source` diferente.
//
// A moeda é separada da do TM de propósito: as duas torneiras têm ritmos
// diferentes (login diário × completar objetivo), e um token só faria a mais
// fácil pagar a mais difícil.

/** `source` gravado em UserPokemonMove quando o desbloqueio veio de um tutor. */
export const TUTOR_SOURCE = "tutor";

/** O método de aprendizado que o tutor cobre (o mesmo nome que a PokéAPI usa). */
const TUTOR_LEARN_METHOD = "tutor";

export type TutorTeachCheck = "ok" | "not_tutor_move" | "already_known";

/**
 * Pode ensinar este golpe por tutor? Decisão pura, antes de gastar token.
 *
 * Espelha o `checkTmTeachable` de propósito, em vez de as duas virarem uma
 * função genérica: são regras de jogo separadas, que podem divergir (um tutor
 * que exigisse nível mínimo, por exemplo, mudaria só esta). Unificar agora
 * economizaria 4 linhas e criaria um parâmetro pra sustentar a diferença depois.
 */
export function checkTutorTeachable(
  learnMethodForMove: string | null,
  alreadyGranted: boolean,
): TutorTeachCheck {
  if (learnMethodForMove !== TUTOR_LEARN_METHOD) return "not_tutor_move";
  if (alreadyGranted) return "already_known";
  return "ok";
}
