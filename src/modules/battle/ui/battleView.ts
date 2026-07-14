import type {
  TableAttackEvent,
  TableLogLine,
  TableMove,
  TablePokemon,
  TableScore,
} from "@/src/modules/battle/ui/BattleTable";
import type { BattleDTO, BattlePokemonDTO, BattleSideLabelDTO, TurnLogDTO } from "./types";

// Traduz o DTO da partida para o que a <BattleTable> desenha.
//
// Tudo aqui é função pura: nenhum hook, nenhum fetch, nenhum React. É o que
// permite testar as regras de apresentação (quem é "Você", o que vira KO, que
// cor cada linha do log tem) sem montar componente nem canvas.

// Qual lado eu sou. Precisa bater com a ordenação que o engine persistiu nos
// eventos do turno — ver resolveTurn.ts: os lados são ordenados por userId.
export function resolveMySide(
  participants: { userId: string }[],
  myUserId: string
): BattleSideLabelDTO | null {
  const [sideAUserId] = participants.map((p) => p.userId).sort();
  if (!sideAUserId) return null;
  return myUserId === sideAUserId ? "A" : "B";
}

export function toTablePokemon(pokemon: BattlePokemonDTO): TablePokemon {
  return {
    slot: pokemon.slot,
    name: pokemon.name,
    spriteUrl: pokemon.spriteUrl,
    types: pokemon.types,
    maxHp: pokemon.maxHp,
    currentHp: pokemon.currentHp,
    fainted: pokemon.fainted,
  };
}

export function toTableMoves(pokemon: BattlePokemonDTO): TableMove[] {
  return pokemon.moves.map((move) => ({
    name: move.name,
    type: move.type,
    power: move.power,
    accuracy: move.accuracy,
  }));
}

export function toScore(me: BattlePokemonDTO[], opponent: BattlePokemonDTO[]): TableScore {
  return {
    myAlive: me.filter((p) => !p.fainted).length,
    myTotal: me.length,
    oppAlive: opponent.filter((p) => !p.fainted).length,
    oppTotal: opponent.length,
  };
}

// Os ataques do último turno, que a mesa usa pra animar dano/crit/miss.
export function toTableEvents(
  lastLog: TurnLogDTO | null,
  mySide: BattleSideLabelDTO
): TableAttackEvent[] | null {
  if (!lastLog) return null;
  return lastLog.events
    .filter((e) => e.type === "attack")
    .map((e) => ({
      bySide: e.side === mySide ? ("mine" as const) : ("enemy" as const),
      damage: e.damage,
      missed: e.missed,
      isCrit: e.isCrit,
      effectiveness: e.effectiveness,
    }));
}

function effectivenessSuffix(effectiveness: number): string {
  if (effectiveness > 1) return " super";
  if (effectiveness === 0) return " imune";
  if (effectiveness < 1) return " pouco";
  return "";
}

function attackTone(isCrit: boolean, effectiveness: number): TableLogLine["tone"] {
  if (isCrit) return "gold";
  if (effectiveness > 1) return "ok";
  if (effectiveness === 0) return "bad";
  if (effectiveness < 1) return "warn";
  return "ink";
}

const LOG_TURNS = 3;

// Log de ações do painel direito: últimos turnos, mais recente no topo.
export function toLogLines(turnLogs: TurnLogDTO[], mySide: BattleSideLabelDTO): TableLogLine[] {
  const lines: TableLogLine[] = [];
  const turns = [...turnLogs].sort((a, b) => b.turnNumber - a.turnNumber).slice(0, LOG_TURNS);

  for (const turn of turns) {
    lines.push({ text: `— TURNO ${String(turn.turnNumber).padStart(2, "0")} —`, tone: "gold" });

    for (const event of turn.events) {
      const who = event.side === mySide ? "Você" : "Inimigo";

      if (event.type === "switch") {
        lines.push({
          text: `${who} → ${event.pokemonName.toUpperCase()}`,
          tone: event.side === mySide ? "energy" : "enemy",
        });
      } else if (event.type === "attack") {
        const move = event.moveName.replace(/-/g, " ").toUpperCase();
        if (event.missed) {
          lines.push({ text: `${who}: ${move} errou`, tone: "inkDim" });
        } else {
          const crit = event.isCrit ? " crit" : "";
          const ko = event.targetFainted ? " KO!" : "";
          lines.push({
            text: `${who}: ${move} ${event.damage}${crit}${effectivenessSuffix(event.effectiveness)}${ko}`,
            tone: attackTone(event.isCrit, event.effectiveness),
          });
        }
      } else {
        lines.push({ text: `${who}: sem ação`, tone: "inkDim" });
      }
    }
  }

  return lines;
}

export interface BattleView {
  mySide: BattleSideLabelDTO;
  myActive: TablePokemon;
  oppActive: TablePokemon;
  bench: TablePokemon[];
  moves: TableMove[];
  score: TableScore;
  logLines: TableLogLine[];
  lastTurnEvents: TableAttackEvent[] | null;
  lastTurnNumber: number;
  needsSwitch: boolean;
  isOver: boolean;
  iWon: boolean;
}

// Um único ponto onde o DTO vira "o que a mesa desenha".
export function selectBattleView(battle: BattleDTO, myUserId: string): BattleView | null {
  const mySide = resolveMySide(battle.participants, myUserId);
  const me = battle.participants.find((p) => p.userId === myUserId);
  const opponent = battle.participants.find((p) => p.userId !== myUserId);
  if (!mySide || !me || !opponent) return null;

  const myActive = me.pokemons.find((p) => p.slot === me.activeSlot);
  const oppActive = opponent.pokemons.find((p) => p.slot === opponent.activeSlot);
  if (!myActive || !oppActive) return null;

  const lastLog = battle.turnLogs[0] ?? null;
  const isOver = battle.status !== "IN_PROGRESS";

  return {
    mySide,
    myActive: toTablePokemon(myActive),
    oppActive: toTablePokemon(oppActive),
    bench: me.pokemons.filter((p) => p.slot !== me.activeSlot).map(toTablePokemon),
    moves: toTableMoves(myActive),
    score: toScore(me.pokemons, opponent.pokemons),
    logLines: toLogLines(battle.turnLogs, mySide),
    lastTurnEvents: toTableEvents(lastLog, mySide),
    lastTurnNumber: lastLog?.turnNumber ?? 0,
    needsSwitch: myActive.fainted,
    isOver,
    iWon: isOver && battle.winnerId === myUserId,
  };
}
