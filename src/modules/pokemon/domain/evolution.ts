// Evolução por NÍVEL, fiel à série (CLAUDE.md § O jogo, regra 4). Puro: sem
// Prisma, sem fetch, sem React. Quem busca a cadeia é lib/pokeapi; quem grava a
// aresta no espelho é commands/syncPokedex; quem troca a espécie do UserPokemon
// é o crédito de XP (battle/commands/awardBattleXp).
//
// O QUE ENTRA: só evolução por `level-up` COM `min_level`. Pedra, troca,
// amizade, hora do dia — tudo que não é "chegar num nível" fica de fora, porque
// não é progressão por nível e a gente não modela essas condições. Ex.: Eevee
// (pedras) não evolui aqui; Charmander→Charmeleon (nv.16) evolui.

/** Uma aresta de evolução por nível: "vira a espécie X ao chegar no nível N". */
export interface EvolutionEdge {
  /** pokemonApiId da espécie de destino. */
  toApiId: number;
  /** nível mínimo pra evoluir. */
  minLevel: number;
}

/** Um detalhe de evolução, como a PokéAPI dá (já normalizado por lib/pokeapi). */
export interface EvolutionDetail {
  /** "level-up" | "use-item" | "trade" | ... */
  trigger: string;
  /** nível exigido. null quando o gatilho não é por nível (pedra/amizade/etc). */
  minLevel: number | null;
}

/** Um nó da cadeia de evolução (árvore). Ver lib/pokeapi.fetchEvolutionChain. */
export interface EvolutionChainNode {
  speciesApiId: number;
  /** as espécies em que ESTE nó evolui, cada uma com como se chega nela. */
  evolvesTo: { details: EvolutionDetail[]; node: EvolutionChainNode }[];
}

/**
 * Extrai da cadeia o mapa `espécie → sua evolução por nível`.
 *
 * Uma espécie tem no máximo UMA aresta aqui (a primeira level-up com min_level
 * encontrada). Ramificação por nível é rara — quando existe (ex.: formas), fica
 * a primeira, que já é o suficiente pra ter progressão. Gatilhos sem min_level
 * (amizade via "level-up", pedra via "use-item") são ignorados de propósito.
 */
export function parseLevelUpEvolutions(root: EvolutionChainNode): Map<number, EvolutionEdge> {
  const edges = new Map<number, EvolutionEdge>();

  function walk(node: EvolutionChainNode): void {
    for (const branch of node.evolvesTo) {
      const byLevel = branch.details.find((d) => d.trigger === "level-up" && d.minLevel != null);
      if (byLevel && byLevel.minLevel != null && !edges.has(node.speciesApiId)) {
        edges.set(node.speciesApiId, { toApiId: branch.node.speciesApiId, minLevel: byLevel.minLevel });
      }
      walk(branch.node);
    }
  }

  walk(root);
  return edges;
}

/**
 * Decisão pura: uma espécie deve evoluir NESTE nível? Devolve o pokemonApiId
 * alvo, ou null se não há evolução por nível ou o nível ainda não bateu.
 */
export function evolutionTargetFor(
  species: { evolvesToApiId: number | null; evolvesToLevel: number | null },
  level: number,
): number | null {
  if (species.evolvesToApiId == null || species.evolvesToLevel == null) return null;
  return level >= species.evolvesToLevel ? species.evolvesToApiId : null;
}

// Evoluir NÃO mexe em carta: sem `DeckSlotCard` (dropado em 2026-08-03) não há
// loadout guardado que possa ficar órfão quando a espécie muda — a barra é
// escolhida ao entrar em campo. Se o loadout voltar a ser persistido, a poda
// volta a ser necessária (o código dela está no git).

/**
 * O nível em que uma espécie É ALCANÇADA por evolução — pra a forma evoluída
 * NASCER num nível condizente (ex.: um Charizard sorteado num pacote não sai
 * nível 1). É o `evolvesToLevel` da PRÉ-evolução que aponta pra esta espécie.
 *
 * Como os níveis de evolução crescem ao longo da cadeia (Charmander→16→Charmeleon
 * →36→Charizard), o da pré-evolução IMEDIATA já é o piso certo — não precisa somar
 * a cadeia inteira. Espécie base (ninguém evolui nela por nível), ou forma que só
 * vem por pedra/troca (sem aresta de nível no espelho), nasce em `startingLevel`.
 *
 * `edges` é o conjunto de arestas de evolução por nível do espelho
 * (`{evolvesToApiId, evolvesToLevel}` de cada espécie). Puro: quem lê o espelho é
 * quem chama (packs/openPack).
 */
export function birthLevelForSpecies(
  edges: readonly { evolvesToApiId: number | null; evolvesToLevel: number | null }[],
  speciesApiId: number,
  startingLevel: number,
): number {
  const preEvo = edges.find((e) => e.evolvesToApiId === speciesApiId && e.evolvesToLevel != null);
  return Math.max(startingLevel, preEvo?.evolvesToLevel ?? startingLevel);
}
