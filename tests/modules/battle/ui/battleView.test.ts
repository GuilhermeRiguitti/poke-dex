import { describe, expect, it } from "vitest";
import {
  duelCalloutFor,
  duelLogMark,
  selectDuelView,
  turnClockView,
  type DuelLogLine,
  type DuelTurnFx,
} from "@/src/modules/battle/ui/battleView";
import type { BattleDTO } from "@/src/modules/battle/ui/types";

function mon(over: Partial<BattleDTO["participants"][number]["pokemons"][number]> = {}) {
  return {
    id: "pk",
    slot: 1,
    pokemonId: 25,
    name: "pikachu",
    spriteUrl: null,
    types: ["electric"],
    level: 20,
    maxHp: 80,
    currentHp: 40,
    fainted: false,
    moves: [
      { id: 1, name: "thunderbolt", type: "electric", power: 90, accuracy: 100, damageClass: "special" as const, priority: 0, maxPp: 15, currentPp: 15 },
      { id: 2, name: "quick-attack", type: "normal", power: 40, accuracy: 100, damageClass: "physical" as const, priority: 1, maxPp: 30, currentPp: 0 },
    ],
    rarity: "common" as const,
    ...over,
  };
}

function battle(over: Partial<BattleDTO> = {}): BattleDTO {
  return {
    id: "b1",
    status: "IN_PROGRESS",
    round: 3,
    winnerId: null,
    submittedUserIds: [],
    turnEndsInMs: 62_000,
    turnTimeoutMs: 90_000,
    participants: [
      { id: "pm", userId: "me", activeSlot: 1, pokemons: [mon()] },
      { id: "po", userId: "opp", activeSlot: 1, pokemons: [mon({ currentHp: 10, name: "bulbasaur" })] },
    ],
    turnLogs: [
      { turnNumber: 4, events: [{ type: "roundStart", round: 3, firstUserId: "me" }] },
      { turnNumber: 3, events: [{ type: "attack", userId: "me", cardName: "thunderbolt", damage: 22, effectiveness: 2, isCrit: false, missed: false, targetFainted: false }] },
    ],
    ...over,
  };
}

describe("selectDuelView", () => {
  it("monta a visão do MEU ponto de vista: posso jogar, HP%, cartas", () => {
    const v = selectDuelView(battle(), "me")!;
    expect(v.canPlay).toBe(true);
    expect(v.waitingOpponent).toBe(false);
    expect(v.me.name).toBe("pikachu");
    expect(v.opp.name).toBe("bulbasaur");
    expect(v.me.hpPct).toBe(50); // 40/80
    expect(v.cards).toHaveLength(2);
    // quick-attack sem PP e ainda há outra com PP → não jogável.
    expect(v.cards[1].disabled).toBe(true);
    expect(v.cards[0].disabled).toBe(false);
  });

  it("já escolhi => a mão trava e eu espero o oponente (não é 'vez dele')", () => {
    const v = selectDuelView(battle({ submittedUserIds: ["me"] }), "me")!;
    expect(v.canPlay).toBe(false);
    expect(v.waitingOpponent).toBe(true);
    expect(v.opponentReady).toBe(false);
  });

  it("o oponente já escolheu, eu não => continuo podendo jogar, e vejo que ele está pronto", () => {
    const v = selectDuelView(battle({ submittedUserIds: ["opp"] }), "me")!;
    expect(v.canPlay).toBe(true);
    expect(v.opponentReady).toBe(true);
  });

  it("log em ordem cronológica (asc por turno), com ator e dano SEPARADOS do texto", () => {
    const v = selectDuelView(battle(), "me")!;
    // turnLogs vêm desc; a view ordena asc por turnNumber → turno 3 (ataque)
    // antes do turno 4 (roundStart).
    const [attack, round] = v.logLines;

    // o relatório desenha a etiqueta e o dano em colunas próprias — se o nome do
    // ator ou o número voltarem pro texto, a linha quebra o alinhamento.
    expect(attack.kind).toBe("attack");
    expect(attack.actor).toBe("me");
    expect(attack.text).toBe("usou");
    expect(attack.subject).toBe("thunderbolt"); // sem hífen: a tela desenha o nome do golpe em destaque
    expect(attack.text).not.toContain("Você");
    expect(attack.damage).toBe(22);
    expect(attack.effectiveness).toBe(2);

    expect(round.kind).toBe("round");
    expect(round.actor).toBeNull();
    expect(round.text).toContain("Rodada 3");
  });

  it("errou: sem dano na coluna (não é 'zero de dano', é dano nenhum)", () => {
    const b = battle({
      turnLogs: [
        {
          turnNumber: 6,
          events: [
            { type: "attack", userId: "opp", cardName: "hydro-pump", damage: 0, effectiveness: 1, isCrit: false, missed: true, targetFainted: false },
          ],
        },
      ],
    });
    const line = selectDuelView(b, "me")!.logLines[0];
    expect(line.actor).toBe("opp");
    expect(line.missed).toBe(true);
    expect(line.damage).toBeNull();
  });

  it("fim de jogo: isOver + iWon pelo winnerId", () => {
    const v = selectDuelView(battle({ status: "FINISHED", winnerId: "me" }), "me")!;
    expect(v.isOver).toBe(true);
    expect(v.iWon).toBe(true);
    expect(v.canPlay).toBe(false); // acabou → não há mais carta a jogar
    expect(v.waitingOpponent).toBe(false);
  });

  it("devolve null se eu não estou na partida", () => {
    expect(selectDuelView(battle(), "estranho")).toBeNull();
  });

  describe("fx (gatilho puro das animações)", () => {
    it("pega a última ação do turno mais alto, do meu ponto de vista", () => {
      // turnLogs: turno 4 = roundStart (sem ação), turno 3 = meu ataque.
      // O fx deve pular o roundStart e cair no ataque do turno 3.
      const fx = selectDuelView(battle(), "me")!.fx!;
      expect(fx.turnNumber).toBe(3);
      expect(fx.kind).toBe("attack");
      expect(fx.actor).toBe("me");
      expect(fx.target).toBe("opp"); // alvo é o oposto do actor
      expect(fx.damage).toBe(22);
      expect(fx.effectiveness).toBe(2);
    });

    it("inverte actor/target pelo ponto de vista do oponente", () => {
      const fx = selectDuelView(battle(), "opp")!.fx!;
      expect(fx.actor).toBe("opp"); // eu (opp) não fui quem agiu
      expect(fx.target).toBe("me"); // o dano veio pra mim
    });

    it("hesitate: actor definido, target null, sem dano", () => {
      const b = battle({
        turnLogs: [{ turnNumber: 5, events: [{ type: "hesitate", userId: "opp" }] }],
      });
      const fx = selectDuelView(b, "me")!.fx!;
      expect(fx.kind).toBe("hesitate");
      expect(fx.actor).toBe("opp");
      expect(fx.target).toBeNull();
      expect(fx.damage).toBe(0);
    });

    it("fx é null quando ninguém agiu ainda (só roundStart)", () => {
      const b = battle({
        turnLogs: [{ turnNumber: 1, events: [{ type: "roundStart", round: 1, firstUserId: "me" }] }],
      });
      expect(selectDuelView(b, "me")!.fx).toBeNull();
    });
  });

  // O leque de reservas desenha a MESMA carta do resto do jogo, então a party
  // precisa carregar o que a moldura pede. Sem isto, a carta na batalha ficaria
  // sem metal, sem tipo e sem nível.
  describe("myParty — o que a carta de reserva precisa", () => {
    it("leva dexNumber, nível, tipos, raridade e HP em número", () => {
      const member = selectDuelView(battle(), "me")!.myParty[0];

      expect(member.dexNumber).toBe("#0025");
      expect(member.level).toBe(20);
      expect(member.types).toEqual(["electric"]);
      expect(member.rarity).toBe("common");
      expect(member.currentHp).toBe(40);
      expect(member.maxHp).toBe(80);
    });

    it("marca quem está em campo — é por isso que o leque filtra", () => {
      // O leque mostra SÓ os reservas; o ativo está no palco 3D.
      const party = selectDuelView(battle(), "me")!.myParty;
      expect(party.filter((m) => m.isActive)).toHaveLength(1);
      expect(party.find((m) => m.isActive)!.slot).toBe(1);
    });
  });
});

// O balão flutua EM CIMA de um dos dois pokémon — então a regra que decide se
// ele aparece (e do lado de quem) é o que impede o texto de nascer na cabeça
// errada. Por isso é função pura com teste, e não um if dentro do componente.
describe("duelCalloutFor", () => {
  function fx(over: Partial<DuelTurnFx> = {}): DuelTurnFx {
    return {
      turnNumber: 1,
      actor: "me",
      kind: "attack",
      cardName: "thunderbolt",
      target: "opp",
      damage: 18,
      effectiveness: 2,
      isCrit: false,
      missed: false,
      fainted: false,
      ...over,
    };
  }

  it("aparece só sobre QUEM LEVOU o golpe", () => {
    expect(duelCalloutFor(fx(), "opp", "ekans")).not.toBeNull();
    expect(duelCalloutFor(fx(), "me", "articuno")).toBeNull();
  });

  it("dano super eficaz: valor negativo + selo, com o nome de quem levou", () => {
    const c = duelCalloutFor(fx(), "opp", "ekans")!;
    expect(c.name).toBe("ekans");
    expect(c.value).toBe("-18");
    expect(c.note).toBe("Super eficaz");
    expect(c.tone).toBe("super");
  });

  it("crítico ganha o tom de crítico e acumula os selos", () => {
    const c = duelCalloutFor(fx({ isCrit: true, fainted: true }), "opp", "ekans")!;
    expect(c.tone).toBe("crit");
    expect(c.note).toBe("Crítico! · Super eficaz · Nocaute!");
  });

  it("errou/imune não mostram número — mostram o porquê", () => {
    expect(duelCalloutFor(fx({ missed: true }), "opp", "ekans")!.value).toBe("Errou");
    expect(duelCalloutFor(fx({ effectiveness: 0 }), "opp", "ekans")!.value).toBe("Imune");
  });

  it("hesitar é do ATOR (quem perdeu o turno), não do alvo", () => {
    const h = fx({ kind: "hesitate", actor: "opp", target: null, damage: 0 });
    expect(duelCalloutFor(h, "opp", "ekans")!.value).toBe("Hesitou");
    expect(duelCalloutFor(h, "me", "articuno")).toBeNull();
  });

  it("sem fx, sem balão", () => {
    expect(duelCalloutFor(null, "me", "articuno")).toBeNull();
  });
});

// O marcador do relatório sai dos CAMPOS da linha. A versão antiga lia o texto
// pronto com regex — mudar uma palavra da frase trocava o ícone em silêncio.
describe("duelLogMark", () => {
  function line(over: Partial<DuelLogLine> = {}): DuelLogLine {
    return {
      key: "1-0",
      kind: "attack",
      actor: "me",
      text: "usou",
      subject: "thunderbolt",
      damage: 18,
      effectiveness: 1,
      isCrit: false,
      missed: false,
      fainted: false,
      ...over,
    };
  }

  it("o nocaute vence o resto — é o que muda a partida", () => {
    expect(duelLogMark(line({ fainted: true, isCrit: true })).glyph).toBe("☠");
  });

  it("errar não é dano fraco: é linha apagada, não vermelha", () => {
    expect(duelLogMark(line({ missed: true })).tone).toBe("dim");
  });

  it("efetividade pinta a linha", () => {
    expect(duelLogMark(line({ effectiveness: 2 })).tone).toBe("bad");
    expect(duelLogMark(line({ effectiveness: 0.5 })).tone).toBe("dim");
    expect(duelLogMark(line({ isCrit: true })).tone).toBe("gold");
  });

  it("rodada e troca têm marcador próprio", () => {
    expect(duelLogMark(line({ kind: "round", actor: null })).glyph).toBe("◆");
    expect(duelLogMark(line({ kind: "switch" })).tone).toBe("energy");
  });
});

describe("turnClockView", () => {
  it("formata minutos:segundos e a fatia da janela que sobrou", () => {
    const v = turnClockView(62_000, 90_000);
    expect(v.text).toBe("1:02");
    expect(v.pct).toBe(69);
    expect(v.expired).toBe(false);
  });

  it("arredonda pra CIMA — no último segundo ainda dá pra jogar", () => {
    // Com floor isto marcaria "0:00" por um segundo inteiro, dizendo que acabou
    // quando o servidor ainda aceita a carta.
    expect(turnClockView(400, 90_000).text).toBe("0:01");
    expect(turnClockView(0, 90_000).text).toBe("0:00");
  });

  it("muda de urgência em 30s e em 10s", () => {
    expect(turnClockView(45_000, 90_000).urgency).toBe("calm");
    expect(turnClockView(30_000, 90_000).urgency).toBe("warn");
    expect(turnClockView(10_000, 90_000).urgency).toBe("critical");
  });

  it("tempo vencido é `expired` — a tela diz 'resolvendo', não '0:00' parado", () => {
    const v = turnClockView(0, 90_000);
    expect(v.expired).toBe(true);
    expect(v.pct).toBe(0);
  });

  it("aguenta valor fora da janela sem estourar a barra", () => {
    expect(turnClockView(120_000, 90_000).pct).toBe(100);
    expect(turnClockView(-5_000, 90_000).pct).toBe(0);
  });
});
