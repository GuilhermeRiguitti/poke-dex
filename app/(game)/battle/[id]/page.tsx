"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useSession } from "@/lib/auth-client";
import type { TableAttackEvent, TableMove, TablePokemon, TableScore } from "@/components/battle/BattleTable";

// Konva só existe no browser — nunca renderizar no servidor
const BattleTable = dynamic(() => import("@/components/battle/BattleTable"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center">
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

// full-bleed: preenche a viewport abaixo da navbar (h-16), largura total até 1920px
// (fora do componente pra não remontar o canvas Konva a cada render)
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 top-16 bg-bg">
      <div className="mx-auto h-full max-w-[1920px]">{children}</div>
    </div>
  );
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

  const submitAction = useCallback(
    async (turnNumber: number, body: { actionType: "MOVE" | "SWITCH"; moveSlot?: number; switchToSlot?: number }) => {
      setSubmitting(true);
      setError("");
      try {
        const res = await fetch(`/api/battle/${params.id}/move`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ turnNumber, ...body }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error ?? "Erro ao jogar"); return; }
        const stillSameTurn = data.currentTurn === turnNumber;
        setBattle(data);
        setWaiting(stillSameTurn && data.status === "IN_PROGRESS");
        stateRef.current = { turnNumber: data.currentTurn, status: data.status };
      } finally {
        setSubmitting(false);
      }
    },
    [params.id]
  );

  if (!battle || !session?.user) {
    return (
      <Shell>
        <div className="flex h-full items-center justify-center">
          <p className="font-semibold text-ink-dim">Carregando partida...</p>
        </div>
      </Shell>
    );
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

  const score: TableScore = {
    myAlive: me.pokemons.filter((p) => !p.fainted).length,
    myTotal: me.pokemons.length,
    oppAlive: opponent.pokemons.filter((p) => !p.fainted).length,
    oppTotal: opponent.pokemons.length,
  };

  const isOver = battle.status !== "IN_PROGRESS";
  const iWon = isOver && battle.winnerId === myUserId;
  const locked = submitting || waiting || isOver;

  return (
    <Shell>
      <div className="relative h-full">
        <BattleTable
          myActive={toTableMon(myActive)}
          oppActive={toTableMon(oppActive)}
          bench={bench.map(toTableMon)}
          moves={tableMoves}
          locked={locked}
          needsSwitch={needsSwitch}
          waiting={waiting}
          turnNumber={battle.currentTurn}
          score={score}
          lastTurnEvents={tableEvents}
          lastTurnNumber={lastLog?.turnNumber ?? 0}
          onAttack={(moveSlot) => submitAction(battle.currentTurn, { actionType: "MOVE", moveSlot })}
          onSwitch={(slot) => submitAction(battle.currentTurn, { actionType: "SWITCH", switchToSlot: slot })}
        />

        {/* toast de erro */}
        {error && (
          <div className="absolute left-1/2 top-4 -translate-x-1/2 rounded-lg bg-bad/90 px-4 py-2 text-sm font-bold text-white">
            {error}
          </div>
        )}

        {/* overlay de fim de partida */}
        {isOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-bg/80 backdrop-blur-sm">
            <span className={`animate-ring-burst absolute h-48 w-48 rounded-full border-4 ${iWon ? "border-gold" : "border-bad"}`} />
            <div
              className={`plate animate-slam px-12 py-4 ${iWon ? "bg-gold" : "bg-bad"}`}
              style={{ filter: iWon ? "drop-shadow(0 0 24px rgba(242,193,78,.5))" : "drop-shadow(0 0 24px rgba(255,92,92,.4))" }}
            >
              <span className={`plate-inner font-title text-6xl uppercase tracking-widest ${iWon ? "text-[#241a05]" : "text-white"}`}>
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
      </div>
    </Shell>
  );
}
