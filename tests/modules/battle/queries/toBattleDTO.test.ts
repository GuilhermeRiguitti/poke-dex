import { describe, expect, it } from "vitest";
import { toBattleDTO } from "@/src/modules/battle/queries/toBattleDTO";

// A linha que resolveIfDue devolve pode vir com `actions` dentro — a carta que o
// jogador da vez escolheu e que ainda NÃO resolveu. As rotas fazem
// NextResponse.json() nisso. Sem o mapper, dava pra abrir o devtools e ler a
// carta pendente do oponente antes do turno virar. E os `stats` de cada pokémon
// (informação de jogo do inimigo) também não podem vazar.
function rowMidTurn() {
  return {
    id: "b1",
    status: "IN_PROGRESS",
    round: 3,
    activeUserId: "zeta",
    winnerId: null,
    turnStartedAt: new Date(),
    participants: [
      {
        id: "part-me",
        userId: "alpha",
        activeSlot: 1,
        pokemons: [
          {
            id: "pk1",
            slot: 1,
            pokemonId: 25,
            name: "pikachu",
            spriteUrl: null,
            types: ["electric"],
            level: 12,
            stats: { hp: 110, attack: 90, defense: 70, specialAttack: 100, specialDefense: 80, speed: 130 },
            maxHp: 110,
            currentHp: 60,
            fainted: false,
            moves: [
              {
                id: 85,
                name: "thunderbolt",
                type: "electric",
                power: 90,
                accuracy: 100,
                damageClass: "special",
                priority: 0,
                maxPp: 15,
                currentPp: 15,
              },
            ],
          },
        ],
      },
    ],
    turnLogs: [{ turnNumber: 3, events: [{ type: "hesitate", userId: "zeta" }] }],
    // O oponente da vez já escolheu a carta dele neste round.
    actions: [{ id: "act1", battleId: "b1", userId: "zeta", round: 3, cardSlot: 2 }],
  };
}

describe("toBattleDTO", () => {
  it("não vaza `actions` — a carta pendente do jogador da vez", () => {
    const dto = toBattleDTO(rowMidTurn());

    expect(dto).not.toHaveProperty("actions");
    // Blindagem de verdade: o cardSlot pendente não pode existir em lugar NENHUM
    // do payload serializado, nem aninhado.
    expect(JSON.stringify(dto)).not.toContain("actions");
    expect(JSON.stringify(dto)).not.toContain("cardSlot");
  });

  it("não vaza os stats de batalha dos pokémons", () => {
    const dto = toBattleDTO(rowMidTurn());
    expect(dto.participants[0].pokemons[0]).not.toHaveProperty("stats");
    expect(JSON.stringify(dto)).not.toContain("specialAttack");
  });

  it("mantém tudo que a mesa precisa desenhar", () => {
    const dto = toBattleDTO(rowMidTurn());
    const pokemon = dto.participants[0].pokemons[0];

    expect(dto.round).toBe(3);
    expect(dto.activeUserId).toBe("zeta");
    expect(dto.status).toBe("IN_PROGRESS");
    expect(pokemon.name).toBe("pikachu");
    expect(pokemon.level).toBe(12);
    expect(pokemon.currentHp).toBe(60);
    expect(pokemon.types).toEqual(["electric"]);
    expect(pokemon.moves[0].name).toBe("thunderbolt");
    expect(dto.turnLogs[0].events[0]).toEqual({ type: "hesitate", userId: "zeta" });
  });
});
