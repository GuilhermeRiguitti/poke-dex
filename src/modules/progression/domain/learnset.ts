// Learnset FIEL À SÉRIE: quem aprende o quê, por qual método, em que nível.
//
// A PokéAPI já modela isso inteiro e nós jogávamos fora: `/pokemon/{id}.moves[]`
// traz, por move, um `version_group_details[]` com (nível, método, jogo). O
// espelho guardava só o par (pokemon, move) — todo pokémon "sabia" o learnset
// inteiro desde o nível 1. Agora o nível LIBERA cartas, que é como a série
// funciona (e é o papel real do nível, não multiplicar o dano da skill).
//
// Puro: sem Prisma, sem fetch, sem React. Quem busca é lib/pokeapi; quem grava
// é commands/syncPokedex; quem filtra por nível é deck/queries/readLearnset.

/** Uma entrada de aprendizado, como a API devolve (por jogo). */
export interface LearnDetail {
  /** nível de aprendizado. 0 quando o método não é level-up. */
  levelLearnedAt: number;
  /** "level-up" | "machine" | "egg" | "tutor" | ... */
  learnMethod: string;
  /** ex: "scarlet-violet" */
  versionGroup: string;
}

/**
 * Version groups do mais RECENTE pro mais antigo.
 *
 * A API devolve o learnset de TODOS os jogos em que a espécie aparece, e eles
 * divergem muito (em Red/Blue o Pikachu aprende thunder-shock no nv.1; em
 * Scarlet/Violet, outra lista inteira). Escolher um é obrigatório — misturar
 * daria "Pikachu que aprende tudo de todas as gerações", que é justamente o
 * que a gente está saindo.
 *
 * Escolhemos o MAIS RECENTE que a espécie tiver: é o learnset mais rico e o que
 * casa com os dados de `Move` no espelho (power/accuracy vêm do endpoint
 * /move, que devolve os valores da geração ATUAL — usar learnset de Gen 1 com
 * números de Gen 9 seria a incoerência mais fácil de introduzir aqui).
 */
export const VERSION_GROUP_PREFERENCE = [
  "scarlet-violet",
  "sword-shield",
  "brilliant-diamond-and-shining-pearl",
  "ultra-sun-ultra-moon",
  "sun-moon",
  "omega-ruby-alpha-sapphire",
  "x-y",
  "black-2-white-2",
  "black-white",
  "heartgold-soulsilver",
  "platinum",
  "diamond-pearl",
  "firered-leafgreen",
  "emerald",
  "ruby-sapphire",
  "crystal",
  "gold-silver",
  "yellow",
  "red-blue",
] as const;

/** O único método que vira carta jogável hoje (ver escolha do dono, §7). */
export const PLAYABLE_LEARN_METHOD = "level-up";

// Desempate entre métodos DENTRO do version group escolhido: um mesmo move
// costuma aparecer como level-up E machine (TM). Guardamos o level-up, que é o
// que carrega a informação de nível.
const METHOD_RANK: Record<string, number> = {
  "level-up": 0,
  machine: 1,
  tutor: 2,
  egg: 3,
};

function methodRank(method: string): number {
  return METHOD_RANK[method] ?? 9;
}

/** Uma linha do learnset já decidida — é o que vai pro banco (PokemonMove). */
export interface LearnsetEntry {
  levelLearnedAt: number;
  learnMethod: string;
  versionGroup: string;
}

/**
 * Escolhe o version group da ESPÉCIE: o primeiro da preferência em que ela
 * aprende ao menos um move por level-up.
 *
 * Exigir level-up (e não "qualquer entrada") não é detalhe: há jogos em que a
 * espécie só é transferível e aparece com TMs soltas. Cair nesse version group
 * daria um pokémon sem nenhuma carta destravável por nível — ou seja, sem jogo.
 * Devolve null se não houver level-up em version group nenhum.
 */
export function pickVersionGroup(details: LearnDetail[]): string | null {
  const withLevelUp = new Set(
    details.filter((d) => d.learnMethod === PLAYABLE_LEARN_METHOD).map((d) => d.versionGroup)
  );
  if (withLevelUp.size === 0) return null;

  for (const vg of VERSION_GROUP_PREFERENCE) {
    if (withLevelUp.has(vg)) return vg;
  }
  // Version group fora da lista (forma/jogo novo que a lista ainda não conhece):
  // não trava o seed — usa o que veio, em ordem estável.
  return [...withLevelUp].sort()[0];
}

/**
 * A entrada que vale pra um move, dentro do version group escolhido: melhor
 * método (level-up primeiro) e, empatando, o menor nível. Null se o move não
 * existe naquele jogo.
 */
export function pickLearnEntry(details: LearnDetail[], versionGroup: string): LearnsetEntry | null {
  const inGroup = details.filter((d) => d.versionGroup === versionGroup);
  if (inGroup.length === 0) return null;

  const best = inGroup.reduce((a, b) => {
    const byMethod = methodRank(a.learnMethod) - methodRank(b.learnMethod);
    if (byMethod !== 0) return byMethod < 0 ? a : b;
    return a.levelLearnedAt <= b.levelLearnedAt ? a : b;
  });

  return {
    levelLearnedAt: best.levelLearnedAt,
    learnMethod: best.learnMethod,
    versionGroup,
  };
}

/**
 * A carta já está destravada pra um pokémon deste nível?
 *
 * Só level-up entra em jogo POR NÍVEL (TM/ovo/tutor ficam gravados no espelho,
 * mas não viram carta só por subir de nível — no jogo real elas não pedem
 * nível). Elas passam a valer quando o jogador as CONCEDE (training/*), via a
 * regra combinada abaixo (mergePlayableMoveIds).
 */
export function isUnlockedAt(entry: { learnMethod: string; levelLearnedAt: number }, level: number): boolean {
  return entry.learnMethod === PLAYABLE_LEARN_METHOD && entry.levelLearnedAt <= level;
}

/**
 * As cartas jogáveis de um Pokémon do jogador = as de LEVEL-UP já destravadas
 * pelo nível ∪ as CONCEDIDAS por fora (TM/tutor/ovo — UserPokemonMove).
 *
 * Pura, e é a ÚNICA fonte da verdade dessa união: deck (addToDeck/readLearnset)
 * e battle (poda pós-evolução) todos passam por aqui, cada um fazendo o próprio
 * I/O e entregando os dois conjuntos de moveId. Sem isto, cada consumidor
 * reimplementaria o "OU concedido" e um deles esqueceria — reabrindo o buraco
 * de uma carta concedida sumir na evolução, ou o addToDeck recusar uma TM.
 */
export function mergePlayableMoveIds(
  levelUpUnlockedIds: Iterable<string>,
  grantedIds: Iterable<string>,
): Set<string> {
  const ids = new Set(levelUpUnlockedIds);
  for (const id of grantedIds) ids.add(id);
  return ids;
}
