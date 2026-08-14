// Cruzamento (ovo). Regra pura: dados os dois pais já lidos, o que nasce.
//
// SEM CHOCO. O serverless não tem worker pra temporizar (CLAUDE.md consequência
// #1), então "o ovo choca em N minutos" exigiria alguém pra virar a ampulheta —
// e não há. O filhote nasce na hora; o freio é um cruzamento por dia UTC.
//
// A regra de compatibilidade é do JOGO, não da série: nada de egg group, gênero
// ou hatch counter (que a PokéAPI dá em /pokemon-species, mas o espelho não
// guarda). Aqui, dois pokémon são compatíveis quando **um sabe um golpe que a
// espécie do outro aprende por ovo** — é o que transforma o repertório numa
// moeda de troca entre as cartas, sem precisar sincronizar campo novo.

import { STARTING_LEVEL } from "./leveling";

/** `source` gravado em UserPokemonMove quando o desbloqueio veio de um ovo. */
export const EGG_SOURCE = "egg";

/** O filhote nasce no mesmo nível de uma carta de pacote. */
export const EGG_BIRTH_LEVEL = STARTING_LEVEL;

export interface BreedingParent {
  userPokemonId: string;
  /** Pokemon.id da ESPÉCIE (não o apiId). */
  pokemonId: string;
}

export interface BreedingResult {
  /** A espécie do filhote. */
  childSpeciesId: string;
  /** O egg move que ele já nasce sabendo. */
  moveId: string;
  /** Qual dos dois pais passou o golpe (o que já sabia). */
  fromParentId: string;
  /** Qual deu a espécie (o que aprende por ovo). */
  speciesFromParentId: string;
}

export type BreedingCheck = "ok" | "same_card" | "no_egg_move";

export interface BreedingInput {
  a: BreedingParent & {
    /** Os golpes que A JÁ PODE usar (level-up destravado ∪ concedidos). */
    playableMoveIds: string[];
  };
  b: BreedingParent & {
    /** Os golpes que a ESPÉCIE de B aprende por ovo. */
    eggMoveIds: string[];
  };
}

/**
 * Resolve UM sentido do cruzamento: A ensina, B dá a espécie.
 *
 * O filhote é da espécie de **B** — a que aprende o golpe por ovo. É o sentido
 * que a série usa (o filhote herda a espécie da mãe e o egg move do pai), e o
 * que faz o cruzamento ter propósito: você usa uma carta que sabe algo pra criar
 * outra espécie que ganha esse algo.
 *
 * A escolha do golpe é **determinística** (o menor `moveId` da interseção) e não
 * sorteada. Não é preguiça: duas lambdas que rodem o preview e o cruzamento em
 * paralelo têm que chegar no MESMO resultado, senão a tela promete um golpe e o
 * banco grava outro. Sortear aqui também tocaria o rng, que o resto do jogo
 * mantém intocado por quem não tem motivo.
 */
export function resolveBreeding({ a, b }: BreedingInput): BreedingResult | null {
  if (a.userPokemonId === b.userPokemonId) return null;

  const eggMoves = new Set(b.eggMoveIds);
  const compartilhados = a.playableMoveIds.filter((id) => eggMoves.has(id));
  if (compartilhados.length === 0) return null;

  const moveId = [...compartilhados].sort()[0];

  return {
    childSpeciesId: b.pokemonId,
    moveId,
    fromParentId: a.userPokemonId,
    speciesFromParentId: b.userPokemonId,
  };
}

/**
 * Tenta os DOIS sentidos e devolve o primeiro que funciona.
 *
 * Existe porque o jogador escolhe dois cards, não "quem é o pai". Obrigá-lo a
 * adivinhar a ordem faria metade das tentativas válidas parecerem incompatíveis
 * — e ele não tem como saber qual das duas espécies aprende o golpe por ovo.
 * A ordem A→B é tentada primeiro pra a escolha ficar estável (mesma entrada,
 * mesma saída).
 */
export function resolveBreedingEitherWay(
  first: BreedingInput["a"] & { eggMoveIds: string[] },
  second: BreedingInput["b"] & { playableMoveIds: string[] },
): BreedingResult | null {
  return (
    resolveBreeding({ a: first, b: second }) ??
    resolveBreeding({ a: second, b: first })
  );
}
