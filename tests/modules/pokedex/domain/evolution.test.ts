import { describe, expect, it } from "vitest";
import {
  evolutionTargetFor,
  parseLevelUpEvolutions,
  pruneLoadout,
  type EvolutionChainNode,
} from "@/src/modules/pokedex/domain/evolution";

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
