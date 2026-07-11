"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useSession } from "@/lib/auth-client";
import type { TableAttackEvent, TableMove, TablePokemon } from "@/components/battle/BattleTable";

// Konva só existe no browser — nunca renderizar no servidor
const BattleTable = dynamic(() => import("@/components/battle/BattleTable"), {
  ssr: false,
  loading: () => (
    <div className="clip-card flex h-96 items-center justify-center border border-edge bg-panel">
      <p className="font-title uppercase tracking-wider text-ink-dim">Montando a mesa...</p>
    </div>
  ),
});

interface BattleMoveDTO {
  id: number;
  name: string;
  type: string;
  power: number | null;
  accuracy: number | null;
  damageClass: "physical" | "special" | "status";
  priority: number;
  maxPp: number;
  currentPp: number;
}

interface BattlePokemonDTO {
  id: string;
  slot: number;
  pokemonId: number;
  name: string;
  spriteUrl: string | null;
  types: string[];
  maxHp: number;
  currentHp: number;
  fainted: boolean;
  moves: BattleMoveDTO[];
}

interface ParticipantDTO {
  id: string;
  userId: string;
  activeSlot: number;
  pokemons: BattlePokemonDTO[];
}

type BattleEventDTO =
  | { type: "switch"; side: "A" | "B"; toSlot: number; pokemonName: string }
  | {
      type: "attack";
      side: "A" | "B";
      moveName: string;
      damage: number;
      effectiveness: number;
      isCrit: boolean;
      missed: boolean;
      targetFainted: boolean;
    }
  | { type: "noAction"; side: "A" | "B" };

interface TurnLogDTO {
  turnNumber: number;
  events: BattleEventDTO[];
}

interface BattleDTO {
  id: string;
  status: "IN_PROGRESS" | "FINISHED" | "ABANDONED";
  currentTurn: number;
  winnerId: string | null;
  participants: ParticipantDTO[];
  turnLogs: TurnLogDTO[];
}

export default function BattlePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { data: session } = useSession();
  const [battle, setBattle] = useState<BattleDTO | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stateRef = useRef<{ turnNumber: number; status: string } | null>(null);

  const loadFullState = useCallback(async () => {
    const res = await fetch(`/api/battle/${params.id}`);
    if (!res.ok) return;
    const data: BattleDTO = await res.json();
    setBattle(data);
    setWaiting(false);
    stateRef.current = { turnNumber: data.currentTurn, status: data.status };
  }, [params.id]);

  useEffect(() => {
    // carga inicial + polling no mesmo efeito; o setState acontece só depois
    // do await (não é síncrono no corpo do efeito — falso positivo da regra)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadFullState();
    pollRef.current = setInterval(async () => {
      const res = await fetch(`/api/battle/${params.id}/status`);
      if (!res.ok) return;
      const data = await res.json();
      const prev = stateRef.current;
      if (!prev || prev.turnNumber !== data.turnNumber || prev.status !== data.status) {
        await loadFullState();
      }
    }, 2000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [params.id, loadFullState]);

  const myUserId = session?.user?.id;

  // "A"/"B" nos eventos são atribuídos por ordenação determinística de userId
  // (ver lib/battle/resolve.ts)
  const mySide: "A" | "B" | null = useMemo(() => {
    if (!battle || !myUserId) return null;
    const [sideAUserId] = battle.participants.map((p) => p.userId).sort();
    return myUserId === sideAUserId ? "A" : "B";
  }, [battle, myUserId]);

  const lastLog = battle?.turnLogs[0] ?? null;

  const tableEvents: TableAttackEvent[] | null = useMemo(() => {
    if (!lastLog || !mySide) return null;
    return lastLog.events
      .filter((e): e is Extract<BattleEventDTO, { type: "attack" }> => e.type === "attack")
      .map((e) => ({
        bySide: e.side === mySide ? ("mine" as const) : ("enemy" as const),
        damage: e.damage,
        missed: e.missed,
        isCrit: e.isCrit,
        effectiveness: e.effectiveness,
      }));
  }, [lastLog, mySide]);

  if (!battle || !session?.user) {
    return <p className="pt-16 text-center font-semibold text-ink-dim">Carregando partida...</p>;
  }

  const me = battle.participants.find((p) => p.userId === myUserId)!;
  const opponent = battle.participants.find((p) => p.userId !== myUserId)!;
  const myActive = me.pokemons.find((p) => p.slot === me.activeSlot)!;
  const oppActive = opponent.pokemons.find((p) => p.slot === opponent.activeSlot)!;
  const needsSwitch = myActive.fainted;
  const bench = me.pokemons.filter((p) => p.slot !== me.activeSlot);

  const toTableMon = (p: BattlePokemonDTO): TablePokemon => ({
    slot: p.slot,
    name: p.name,
    spriteUrl: p.spriteUrl,
    types: p.types,
    maxHp: p.maxHp,
    currentHp: p.currentHp,
    fainted: p.fainted,
  });

  const tableMoves: TableMove[] = myActive.moves.map((m) => ({
    name: m.name,
    type: m.type,
    power: m.power,
    accuracy: m.accuracy,
  }));

  const submitAction = async (body: { actionType: "MOVE" | "SWITCH"; moveSlot?: number; switchToSlot?: number }) => {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/battle/${params.id}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turnNumber: battle.currentTurn, ...body }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Erro ao jogar"); return; }
      const stillSameTurn = data.currentTurn === battle.currentTurn;
      setBattle(data);
      setWaiting(stillSameTurn && data.status === "IN_PROGRESS");
      stateRef.current = { turnNumber: data.currentTurn, status: data.status };
    } finally {
      setSubmitting(false);
    }
  };

  const isOver = battle.status !== "IN_PROGRESS";
  const iWon = isOver && battle.winnerId === myUserId;
  const locked = submitting || waiting || isOver;

  return (
    <div className="pt-6">
      {/* placar de turno */}
      <div className="mb-4 flex items-center justify-center gap-4">
        <div className="plate border border-edge bg-panel px-5 py-1.5">
          <span className="plate-inner font-title tracking-[0.2em] text-ink-dim">
            TURNO{" "}
            <span key={battle.currentTurn} className="animate-count-flash inline-block text-xl text-ink tabular-nums">
              {String(battle.currentTurn).padStart(2, "0")}
            </span>
          </span>
        </div>
        {waiting && (
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-radar absolute inline-flex h-full w-full rounded-full bg-energy" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-energy" />
            </span>
            <span className="text-sm font-bold uppercase tracking-wide text-ink-dim">
              Aguardando o inimigo...
            </span>
          </div>
        )}
      </div>

      {/* tela de fim de partida — o momento mais caprichado */}
      {isOver && (
        <div className="relative mb-6 flex flex-col items-center gap-4 overflow-hidden py-10">
          <span
            className={`animate-ring-burst absolute top-1/3 h-40 w-40 rounded-full border-4 ${
              iWon ? "border-gold" : "border-bad"
            }`}
          />
          <div
            className={`plate animate-slam px-10 py-3 ${iWon ? "bg-gold" : "bg-bad"}`}
            style={{
              filter: iWon
                ? "drop-shadow(0 0 24px rgba(242,193,78,.5))"
                : "drop-shadow(0 0 24px rgba(255,92,92,.4))",
            }}
          >
            <span
              className={`plate-inner font-title text-5xl uppercase tracking-widest ${
                iWon ? "text-[#241a05]" : "text-white"
              }`}
            >
              {battle.status === "ABANDONED" ? (iWon ? "W.O." : "Abandono") : iWon ? "Vitória" : "Derrota"}
            </span>
          </div>
          {battle.status === "ABANDONED" && (
            <p className="text-sm font-semibold text-ink-dim">
              {iWon ? "O oponente abandonou a partida." : "Você abandonou a partida."}
            </p>
          )}
          <button
            onClick={() => router.push("/battle")}
            className="clip-btn cursor-pointer border-0 bg-flare px-6 py-2.5 font-title uppercase tracking-wider text-white transition-colors hover:bg-flare-dark"
          >
            Nova partida
          </button>
        </div>
      )}

      {error && <p className="mb-2 text-sm font-semibold text-bad">{error}</p>}

      {/* a mesa */}
      <BattleTable
        myActive={toTableMon(myActive)}
        oppActive={toTableMon(oppActive)}
        bench={bench.map(toTableMon)}
        moves={tableMoves}
        locked={locked}
        needsSwitch={needsSwitch}
        lastTurnEvents={tableEvents}
        lastTurnNumber={lastLog?.turnNumber ?? 0}
        onAttack={(moveSlot) => submitAction({ actionType: "MOVE", moveSlot })}
        onSwitch={(slot) => submitAction({ actionType: "SWITCH", switchToSlot: slot })}
      />

      {/* fallback acessível pra troca obrigatória (mesmo gesto da mesa, sem drag) */}
      {!isOver && needsSwitch && !locked && (
        <div className="mt-4">
          <p className="mb-2 text-sm font-bold uppercase tracking-wide text-ink-dim">
            Ou toque pra trocar:
          </p>
          <div className="flex flex-wrap gap-2">
            {bench
              .filter((p) => !p.fainted)
              .map((p) => (
                <button
                  key={p.id}
                  disabled={submitting}
                  onClick={() => submitAction({ actionType: "SWITCH", switchToSlot: p.slot })}
                  className="clip-btn cursor-pointer border border-edge bg-panel px-3 py-2 text-sm font-bold uppercase tracking-wide transition-colors hover:border-energy/60 disabled:opacity-50"
                >
                  {p.name} ({p.currentHp}/{p.maxHp})
                </button>
              ))}
          </div>
        </div>
      )}

      {/* feed do último turno */}
      {lastLog && (
        <div className="clip-card mt-4 border border-edge bg-panel-2/70 p-4 text-sm">
          <p className="mb-1.5 font-title text-xs uppercase tracking-widest text-ink-dim">
            Turno {String(lastLog.turnNumber).padStart(2, "0")}
          </p>
          {lastLog.events.map((e, i) => (
            <p key={i} className="font-semibold text-ink-dim">
              {e.type === "switch" &&
                `${e.side === mySide ? "Você trocou" : "Inimigo trocou"} para ${e.pokemonName}`}
              {e.type === "attack" &&
                (e.missed ? (
                  <>
                    <b className="uppercase text-ink">{e.moveName.replace(/-/g, " ")}</b> errou!
                  </>
                ) : (
                  <>
                    <b className="uppercase text-ink">{e.moveName.replace(/-/g, " ")}</b>:{" "}
                    <span className="tabular-nums">{e.damage}</span> de dano
                    {e.isCrit && <span className="text-gold"> · CRÍTICO!</span>}
                    {e.effectiveness > 1 && <span className="text-ok"> · super efetivo</span>}
                    {e.effectiveness < 1 && e.effectiveness > 0 && (
                      <span className="text-warn"> · pouco efetivo</span>
                    )}
                    {e.effectiveness === 0 && <span className="text-bad"> · sem efeito</span>}
                    {e.targetFainted && <span className="text-bad"> · desmaiou!</span>}
                  </>
                ))}
              {e.type === "noAction" && "Sem ação"}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
