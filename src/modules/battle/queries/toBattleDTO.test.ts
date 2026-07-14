import { describe, expect, it } from "vitest";
import { toBattleDTO } from "./toBattleDTO";

// A linha que tryResolveTurn devolve quando o turno AINDA NÃO resolveu (o caso
// comum do polling: eu joguei, o oponente não) vem com `pendingMoves` dentro —
// as jogadas dos dois lados deste turno. As rotas fazem NextResponse.json()
// nisso. Sem o mapper, dava pra abrir o devtools e ler o move do oponente
// antes do turno virar.
function rowMidTurn() {
  return {
    id: "b1",
    status: "IN_PROGRESS",
    currentTurn: 3,
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
            level: 50,
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
    turnLogs: [{ turnNumber: 2, events: [{ type: "noAction", side: "B" }] }],
    // O oponente já escolheu o golpe dele neste turno.
    pendingMoves: [
      { id: "pm1", battleId: "b1", userId: "zeta", turnNumber: 3, actionType: "MOVE", moveSlot: 2, switchToSlot: null },
    ],
  };
}

describe("toBattleDTO", () => {
  it("não vaza pendingMoves — a jogada do oponente no turno em aberto", () => {
    const dto = toBattleDTO(rowMidTurn());

    expect(dto).not.toHaveProperty("pendingMoves");
    // Blindagem de verdade: o moveSlot do oponente não pode existir em lugar
    // NENHUM do payload serializado, nem aninhado.
    expect(JSON.stringify(dto)).not.toContain("pendingMoves");
    expect(JSON.stringify(dto)).not.toContain("zeta");
  });

  it("não vaza os stats de batalha dos pokémons", () => {
    const dto = toBattleDTO(rowMidTurn());
    expect(dto.participants[0].pokemons[0]).not.toHaveProperty("stats");
    expect(JSON.stringify(dto)).not.toContain("specialAttack");
  });

  it("mantém tudo que a mesa precisa desenhar", () => {
    const dto = toBattleDTO(rowMidTurn());
    const pokemon = dto.participants[0].pokemons[0];

    expect(dto.currentTurn).toBe(3);
    expect(dto.status).toBe("IN_PROGRESS");
    expect(pokemon.name).toBe("pikachu");
    expect(pokemon.currentHp).toBe(60);
    expect(pokemon.types).toEqual(["electric"]);
    expect(pokemon.moves[0].name).toBe("thunderbolt");
    expect(dto.turnLogs[0].events[0]).toEqual({ type: "noAction", side: "B" });
  });
});
