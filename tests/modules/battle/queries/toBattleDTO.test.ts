import { describe, expect, it } from "vitest";
import { toBattleDTO } from "@/src/modules/battle/queries/toBattleDTO";

// A linha que resolveIfDue lê vem com `actions` dentro — a carta que o oponente
// escolheu pro round que ainda NÃO resolveu. As rotas fazem
// NextResponse.json() nisso. Sem o mapper, dava pra abrir o devtools e ler a
// jogada do adversário JUSTAMENTE na janela em que a escolha é às cegas — que é
// o coração do turno simultâneo. E os `stats` de cada pokémon (informação de
// jogo do inimigo) também não podem vazar.
function rowMidTurn() {
  return {
    id: "b1",
    status: "IN_PROGRESS",
    round: 3,
    winnerId: null,
    turnStartedAt: new Date(),
    // Piso da presença pra quem nunca carimbou.
    createdAt: new Date(),
    participants: [
      {
        id: "part-me",
        userId: "alpha",
        activeSlot: 1,
        energy: 3,
        lastSeenAt: new Date(),
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
            conditions: {
              status: "burn",
              // Quantos turnos o sono ainda dura é ESCONDIDO — na série também.
              sleepTurns: 3,
              stages: { attack: 2, defense: 0, specialAttack: 0, specialDefense: 0, speed: -1, accuracy: 0, evasion: 0 },
              confusionTurns: 2,
              seeded: true,
              flinched: false,
            },
          },
        ],
      },
    ],
    turnLogs: [{ turnNumber: 3, events: [{ type: "hesitate", userId: "zeta" }] }],
    // O oponente da vez já escolheu a carta dele neste round — e, se for troca,
    // a barra de skills com que o pokémon dele vai entrar.
    actions: [
      {
        id: "act1",
        battleId: "b1",
        userId: "zeta",
        round: 3,
        cardSlot: 2,
        loadout: ["move-flamethrower", "move-earthquake"],
      },
    ],
  };
}

describe("toBattleDTO", () => {
  it("não vaza `actions` — a carta que o oponente escolheu no round em aberto", () => {
    const dto = toBattleDTO(rowMidTurn());

    expect(dto).not.toHaveProperty("actions");
    // Blindagem de verdade: o cardSlot pendente não pode existir em lugar NENHUM
    // do payload serializado, nem aninhado.
    expect(JSON.stringify(dto)).not.toContain("actions");
    expect(JSON.stringify(dto)).not.toContain("cardSlot");
  });

  // Mesma classe de vazamento que o cardSlot, e ela nasceu quando a escolha de
  // skills virou decisão de batalha: a barra que o oponente montou pro pokémon
  // que vai entrar é segredo até ele entrar. Vazar aqui entregaria o repertório
  // dele com um round de antecedência — dava pra escolher o counter perfeito.
  it("não vaza o `loadout` — a barra escolhida pro pokémon que vai entrar", () => {
    const dto = toBattleDTO(rowMidTurn());

    expect(JSON.stringify(dto)).not.toContain("loadout");
    expect(JSON.stringify(dto)).not.toContain("flamethrower");
    expect(JSON.stringify(dto)).not.toContain("earthquake");
  });

  it("diz QUEM já escolheu, e só do round atual", () => {
    const row = rowMidTurn();
    row.actions.push({ id: "act0", battleId: "b1", userId: "alpha", round: 2, cardSlot: 5, loadout: [] });
    const dto = toBattleDTO(row);

    // zeta jogou no round 3 (atual); a linha de alpha é do round 2 e não conta.
    expect(dto.submittedUserIds).toEqual(["zeta"]);
  });

  it("não vaza os stats de batalha dos pokémons", () => {
    const dto = toBattleDTO(rowMidTurn());
    expect(dto.participants[0].pokemons[0]).not.toHaveProperty("stats");
    expect(JSON.stringify(dto)).not.toContain("specialAttack");
  });

  it("leva a raridade calculada no servidor (metal da moldura da carta)", () => {
    const dto = toBattleDTO(rowMidTurn());
    // Pikachu tem BST 320 -> "common". Vem do servidor porque bstOf carrega a
    // tabela dos 1025 BSTs, que não pode ir pro bundle da arena (cliente).
    expect(dto.participants[0].pokemons[0].rarity).toBe("common");
  });

  // Status e estágio são informação PÚBLICA (na série você vê que o oponente
  // está queimado). O que não sai é a contagem do sono — entregar viraria
  // "espero exatamente 2 turnos e ataco no 3º".
  it("leva o estado alterado, mas esconde a contagem do sono", () => {
    const dto = toBattleDTO(rowMidTurn());
    const c = dto.participants[0].pokemons[0].conditions;

    expect(c.status).toBe("burn");
    expect(c.confused).toBe(true);
    expect(c.seeded).toBe(true);
    expect(c.stages).toEqual([
      { stat: "attack", stage: 2 },
      { stat: "speed", stage: -1 },
    ]);
    expect(JSON.stringify(dto)).not.toContain("sleepTurns");
  });

  it("a raridade NÃO é informação nova — sai do pokemonId que já ia no DTO", () => {
    const dto = toBattleDTO(rowMidTurn());
    expect(dto.participants[0].pokemons[0].pokemonId).toBe(25);
  });

  // O countdown da tela sai daqui, e RELATIVO: o relógio do browser pode estar
  // torto, então quem faz a subtração é o servidor (ver turnEndsInMs em ui/types).
  it("leva quanto RESTA do round, contado com o relógio do servidor", () => {
    const now = Date.now();
    const row = { ...rowMidTurn(), turnStartedAt: new Date(now - 30_000) };
    const dto = toBattleDTO(row, now);

    expect(dto.turnTimeoutMs).toBe(90_000);
    expect(dto.turnEndsInMs).toBe(60_000);
    // Nada de instante absoluto no payload: um deadline em ISO convidaria o
    // cliente a fazer `deadline - Date.now()` e herdar o próprio desvio.
    expect(dto).not.toHaveProperty("turnStartedAt");
    expect(JSON.stringify(dto)).not.toContain("turnStartedAt");
  });

  it("turno já vencido chega zerado, não negativo", () => {
    const now = Date.now();
    const row = { ...rowMidTurn(), turnStartedAt: new Date(now - 90_000 * 40) };
    expect(toBattleDTO(row, now).turnEndsInMs).toBe(0);
  });

  it("mantém tudo que a mesa precisa desenhar", () => {
    const dto = toBattleDTO(rowMidTurn());
    const pokemon = dto.participants[0].pokemons[0];

    expect(dto.round).toBe(3);
    expect(dto.status).toBe("IN_PROGRESS");
    expect(pokemon.name).toBe("pikachu");
    expect(pokemon.level).toBe(12);
    expect(pokemon.currentHp).toBe(60);
    expect(pokemon.types).toEqual(["electric"]);
    expect(pokemon.moves[0].name).toBe("thunderbolt");
    expect(dto.turnLogs[0].events[0]).toEqual({ type: "hesitate", userId: "zeta" });
  });
});
