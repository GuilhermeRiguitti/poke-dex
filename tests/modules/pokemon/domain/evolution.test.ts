import { describe, expect, it } from "vitest";
import {
  birthLevelForSpecies,
  evolutionTargetFor,
  parseLevelUpEvolutions,
  pruneLoadout,
  refillLoadout,
  type EvolutionChainNode,
} from "@/src/modules/progression/domain/evolution";

// Imita a cadeia da PokéAPI já normalizada por lib/pokeapi: Bulbasaur(1) →
// Ivysaur(2, nv.16) → Venusaur(3, nv.32). Uma linha level-up pura.
const bulbaChain: EvolutionChainNode = {
  speciesApiId: 1,
  evolvesTo: [
    {
      details: [{ trigger: "level-up", minLevel: 16 }],
      node: {
        speciesApiId: 2,
        evolvesTo: [
          {
            details: [{ trigger: "level-up", minLevel: 32 }],
            node: { speciesApiId: 3, evolvesTo: [] },
          },
        ],
      },
    },
  ],
};

describe("parseLevelUpEvolutions", () => {
  it("extrai a aresta de cada espécie da cadeia", () => {
    const edges = parseLevelUpEvolutions(bulbaChain);
    expect(edges.get(1)).toEqual({ toApiId: 2, minLevel: 16 });
    expect(edges.get(2)).toEqual({ toApiId: 3, minLevel: 32 });
    expect(edges.has(3)).toBe(false); // Venusaur não evolui
  });

  it("IGNORA gatilhos que não são level-up com nível (pedra, amizade, troca)", () => {
    // Eevee(133) → Vaporeon por water-stone (use-item, sem min_level) e uma
    // evolução por amizade (level-up SEM min_level). Nenhuma vira aresta.
    const eevee: EvolutionChainNode = {
      speciesApiId: 133,
      evolvesTo: [
        { details: [{ trigger: "use-item", minLevel: null }], node: { speciesApiId: 134, evolvesTo: [] } },
        { details: [{ trigger: "level-up", minLevel: null }], node: { speciesApiId: 196, evolvesTo: [] } },
      ],
    };
    const edges = parseLevelUpEvolutions(eevee);
    expect(edges.size).toBe(0);
  });
});

describe("evolutionTargetFor", () => {
  const ivysaur = { evolvesToApiId: 3, evolvesToLevel: 32 };

  it("devolve o alvo quando o nível bateu (>=)", () => {
    expect(evolutionTargetFor(ivysaur, 32)).toBe(3);
    expect(evolutionTargetFor(ivysaur, 40)).toBe(3);
  });

  it("devolve null antes do nível", () => {
    expect(evolutionTargetFor(ivysaur, 31)).toBeNull();
  });

  it("devolve null quando a espécie não evolui por nível", () => {
    expect(evolutionTargetFor({ evolvesToApiId: null, evolvesToLevel: null }, 100)).toBeNull();
    expect(evolutionTargetFor({ evolvesToApiId: 3, evolvesToLevel: null }, 100)).toBeNull();
  });
});

describe("pruneLoadout", () => {
  it("mantém só as cartas que a nova espécie conhece, na ordem original", () => {
    const valid = new Set(["a", "c"]);
    expect(pruneLoadout(["a", "b", "c", "d"], valid)).toEqual(["a", "c"]);
  });

  it("pode zerar o loadout se nenhuma carta sobrevive", () => {
    expect(pruneLoadout(["x", "y"], new Set<string>())).toEqual([]);
  });
});

describe("refillLoadout", () => {
  // O caso real: Caterpie (tackle, string-shot) evolui no nv.7 e o learnset por
  // level-up de Metapod é só harden. A poda zera o slot — e slot vazio deixa o
  // pokémon INJOGÁVEL (buildDuelSnapshot lança) e travava o matchmaking.
  const metapod = [{ moveId: "harden", levelLearnedAt: 1 }];

  it("loadout ZERADO pela poda é reposto com o que a nova espécie conhece", () => {
    expect(refillLoadout([], metapod, 6)).toEqual(["harden"]);
  });

  it("loadout que sobreviveu NÃO é mexido — nem pra completar", () => {
    // Escolha do jogador. Repor aqui trocaria carta na mão dele sem pedir.
    expect(refillLoadout(["tackle"], metapod, 6)).toEqual(["tackle"]);
  });

  it("repõe as de nível MAIS ALTO primeiro e respeita o teto de cartas", () => {
    const learnset = [
      { moveId: "m1", levelLearnedAt: 1 },
      { moveId: "m20", levelLearnedAt: 20 },
      { moveId: "m10", levelLearnedAt: 10 },
    ];
    expect(refillLoadout([], learnset, 2)).toEqual(["m20", "m10"]);
  });

  it("empate de nível desempata por id — duas lambdas concorrentes convergem", () => {
    const learnset = [
      { moveId: "b", levelLearnedAt: 5 },
      { moveId: "a", levelLearnedAt: 5 },
    ];
    expect(refillLoadout([], learnset, 6)).toEqual(["a", "b"]);
  });

  it("sem candidata nenhuma, devolve vazio em vez de inventar carta", () => {
    expect(refillLoadout([], [], 6)).toEqual([]);
  });
});

describe("birthLevelForSpecies", () => {
  // Linha do Charmander: 4 →(16)→ 5 →(36)→ 6. As arestas do espelho.
  const edges = [
    { evolvesToApiId: 5, evolvesToLevel: 16 }, // Charmander → Charmeleon
    { evolvesToApiId: 6, evolvesToLevel: 36 }, // Charmeleon → Charizard
    { evolvesToApiId: null, evolvesToLevel: null }, // Charizard (não evolui)
  ];
  const START = 1;

  it("forma-base nasce em STARTING_LEVEL", () => {
    expect(birthLevelForSpecies(edges, 4, START)).toBe(1);
  });

  it("estágio do meio nasce no nível da sua pré-evolução (Charmeleon = 16)", () => {
    expect(birthLevelForSpecies(edges, 5, START)).toBe(16);
  });

  // O caso do dono: um Charizard de pacote não pode sair nível 1.
  it("forma final nasce no nível da pré-evolução IMEDIATA (Charizard = 36, não soma a cadeia)", () => {
    expect(birthLevelForSpecies(edges, 6, START)).toBe(36);
  });

  it("espécie sem aresta de nível (pedra/troca, ou desconhecida) cai em STARTING_LEVEL", () => {
    expect(birthLevelForSpecies(edges, 999, START)).toBe(1);
    // Vulpix→Ninetales é por pedra: sem aresta de nível apontando pra Ninetales.
    expect(birthLevelForSpecies([{ evolvesToApiId: null, evolvesToLevel: null }], 38, START)).toBe(1);
  });

  it("nunca devolve abaixo de STARTING_LEVEL", () => {
    expect(birthLevelForSpecies([{ evolvesToApiId: 7, evolvesToLevel: 1 }], 7, 5)).toBe(5);
  });
});
