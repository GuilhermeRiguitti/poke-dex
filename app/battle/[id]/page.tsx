"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "@/lib/auth-client";

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

function HpBar({ current, max }: { current: number; max: number }) {
  const pct = Math.max(0, Math.min(100, (current / max) * 100));
  const color = pct > 50 ? "bg-green-500" : pct > 20 ? "bg-yellow-500" : "bg-red-600";
  return (
    <div className="w-full h-3 bg-black/40 rounded overflow-hidden border border-white/30">
      <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
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
  const [showSwitchMenu, setShowSwitchMenu] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stateRef = useRef<{ turnNumber: number; status: string } | null>(null);

  const loadFullState = useCallback(async () => {
    const res = await fetch(`/api/battle/${params.id}`);
    if (!res.ok) return;
    const data: BattleDTO = await res.json();
    setBattle(data);
    setShowSwitchMenu(false);
    stateRef.current = { turnNumber: data.currentTurn, status: data.status };
  }, [params.id]);

  useEffect(() => {
    loadFullState();
  }, [loadFullState]);

  useEffect(() => {
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

  if (!battle || !session?.user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white bg-[#0a1a3a]">
        <p>Carregando partida...</p>
      </div>
    );
  }

  const myUserId = session.user.id;
  const me = battle.participants.find((p) => p.userId === myUserId)!;
  const opponent = battle.participants.find((p) => p.userId !== myUserId)!;
  // "A"/"B" nos eventos do log são atribuídos por ordenação determinística
  // de userId (ver lib/battle/resolve.ts) — não pela ordem de retorno da API.
  const [sideAUserId] = [...battle.participants].map((p) => p.userId).sort();
  const mySide: "A" | "B" = myUserId === sideAUserId ? "A" : "B";
  const myActive = me.pokemons.find((p) => p.slot === me.activeSlot)!;
  const oppActive = opponent.pokemons.find((p) => p.slot === opponent.activeSlot)!;
  const needsSwitch = myActive.fainted;
  const survivors = me.pokemons.filter((p) => !p.fainted && p.slot !== me.activeSlot);

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
      setBattle(data);
      setShowSwitchMenu(false);
      stateRef.current = { turnNumber: data.currentTurn, status: data.status };
    } finally {
      setSubmitting(false);
    }
  };

  const lastLog = battle.turnLogs[0];
  const isOver = battle.status !== "IN_PROGRESS";
  const iWon = isOver && battle.winnerId === myUserId;

  return (
    <div className="min-h-screen bg-[#0a1a3a] text-white pb-16">
      <nav className="grid grid-cols-[1fr_2fr_1fr] w-full items-center justify-items-center h-max py-2">
        <Link href="/">
          <img
            src="https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/Pok%C3%A9_Ball_icon.svg/1200px-Pok%C3%A9_Ball_icon.svg.png"
            alt="Home"
            className="w-16 h-16 cursor-pointer"
          />
        </Link>
        <h1 className="font-bold text-lg">Turno {battle.currentTurn}</h1>
      </nav>

      {isOver && (
        <div className="flex flex-col items-center gap-3 my-6">
          <p className={`text-2xl font-bold ${iWon ? "text-green-400" : "text-red-400"}`}>
            {battle.status === "ABANDONED"
              ? iWon ? "Vitória por W.O. — oponente abandonou" : "Você abandonou a partida"
              : iWon ? "Você venceu!" : "Você perdeu."}
          </p>
          <button
            onClick={() => router.push("/battle")}
            className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded cursor-pointer border-0"
          >
            Nova partida
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto px-4 mt-4">
        {/* Oponente */}
        <div className="bg-blue-950/50 rounded-xl p-4 border border-white/20">
          <p className="text-sm text-white/60 mb-1">Oponente</p>
          <p className="font-bold text-lg mb-1">
            {oppActive.name.toUpperCase()} {oppActive.fainted && "(desmaiado)"}
          </p>
          <p className="text-xs mb-1">{oppActive.types.join(" / ")}</p>
          <HpBar current={oppActive.currentHp} max={oppActive.maxHp} />
          <p className="text-xs mt-1">{oppActive.currentHp} / {oppActive.maxHp} HP</p>
          {oppActive.spriteUrl && (
            <img src={oppActive.spriteUrl} alt={oppActive.name} className="w-32 h-32 mx-auto mt-2" />
          )}
          <p className="text-xs text-white/50 mt-2">
            Time: {opponent.pokemons.filter((p) => !p.fainted).length}/{opponent.pokemons.length} vivos
          </p>
        </div>

        {/* Meu time */}
        <div className="bg-green-950/50 rounded-xl p-4 border border-white/20">
          <p className="text-sm text-white/60 mb-1">Você</p>
          <p className="font-bold text-lg mb-1">
            {myActive.name.toUpperCase()} {myActive.fainted && "(desmaiado)"}
          </p>
          <p className="text-xs mb-1">{myActive.types.join(" / ")}</p>
          <HpBar current={myActive.currentHp} max={myActive.maxHp} />
          <p className="text-xs mt-1">{myActive.currentHp} / {myActive.maxHp} HP</p>
          {myActive.spriteUrl && (
            <img src={myActive.spriteUrl} alt={myActive.name} className="w-32 h-32 mx-auto mt-2" />
          )}
        </div>
      </div>

      {lastLog && (
        <div className="max-w-4xl mx-auto px-4 mt-4 bg-black/30 rounded-lg p-3 text-sm">
          <p className="text-white/50 mb-1">Turno {lastLog.turnNumber}:</p>
          {lastLog.events.map((e, i) => (
            <p key={i}>
              {e.type === "switch" && `${e.side === mySide ? "Você" : "Oponente"} trocou para ${e.pokemonName}`}
              {e.type === "attack" &&
                (e.missed
                  ? `Ataque errou (${e.moveName})`
                  : `${e.moveName}: ${e.damage} de dano${e.isCrit ? " (crítico!)" : ""}${e.effectiveness > 1 ? " — super efetivo!" : e.effectiveness < 1 && e.effectiveness > 0 ? " — pouco efetivo" : e.effectiveness === 0 ? " — sem efeito" : ""}`)}
              {e.type === "noAction" && "Sem ação"}
            </p>
          ))}
        </div>
      )}

      {!isOver && (
        <div className="max-w-4xl mx-auto px-4 mt-6">
          {error && <p className="text-red-400 mb-2">{error}</p>}

          {needsSwitch ? (
            <>
              <p className="mb-2 font-bold">Seu pokémon desmaiou — escolha o substituto:</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {survivors.map((p) => (
                  <button
                    key={p.id}
                    disabled={submitting}
                    onClick={() => submitAction({ actionType: "SWITCH", switchToSlot: p.slot })}
                    className="bg-green-700 hover:bg-green-600 disabled:opacity-50 rounded p-2 cursor-pointer border-0 text-sm"
                  >
                    {p.name.toUpperCase()} ({p.currentHp}/{p.maxHp})
                  </button>
                ))}
              </div>
            </>
          ) : showSwitchMenu ? (
            <>
              <p className="mb-2 font-bold">Trocar para:</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-2">
                {survivors.map((p) => (
                  <button
                    key={p.id}
                    disabled={submitting}
                    onClick={() => submitAction({ actionType: "SWITCH", switchToSlot: p.slot })}
                    className="bg-green-700 hover:bg-green-600 disabled:opacity-50 rounded p-2 cursor-pointer border-0 text-sm"
                  >
                    {p.name.toUpperCase()} ({p.currentHp}/{p.maxHp})
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowSwitchMenu(false)}
                className="text-white/60 underline cursor-pointer bg-transparent border-0 text-sm"
              >
                Cancelar
              </button>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                {myActive.moves.map((move, i) => (
                  <button
                    key={move.id + "-" + i}
                    disabled={submitting}
                    onClick={() => submitAction({ actionType: "MOVE", moveSlot: i })}
                    className="bg-orange-700 hover:bg-orange-600 disabled:opacity-50 rounded p-2 cursor-pointer border-0 text-left"
                  >
                    <span className="font-bold block">{move.name.toUpperCase()}</span>
                    <span className="text-xs text-white/70">
                      {move.type} · poder {move.power ?? "-"} · precisão {move.accuracy ?? 100}%
                    </span>
                  </button>
                ))}
              </div>
              {survivors.length > 0 && (
                <button
                  onClick={() => setShowSwitchMenu(true)}
                  disabled={submitting}
                  className="mt-3 text-white/70 underline cursor-pointer bg-transparent border-0 text-sm disabled:opacity-50"
                >
                  Trocar de pokémon
                </button>
              )}
            </>
          )}

          {submitting && <p className="mt-2 text-white/60">Enviando...</p>}
        </div>
      )}
    </div>
  );
}
