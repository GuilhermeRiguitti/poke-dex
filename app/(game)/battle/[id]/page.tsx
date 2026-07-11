"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import TypeBadge from "@/components/TypeBadge";
import { typeColor } from "@/lib/typeColors";

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
  const color = pct > 50 ? "bg-ok" : pct > 20 ? "bg-warn" : "bg-bad";
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full border border-edge bg-surface-2">
      <div className={`h-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function TeamDots({ pokemons }: { pokemons: BattlePokemonDTO[] }) {
  return (
    <div className="flex gap-1">
      {pokemons.map((p) => (
        <span
          key={p.id}
          title={p.name}
          className={`h-2.5 w-2.5 rounded-full ${p.fainted ? "bg-edge" : "bg-ok"}`}
        />
      ))}
    </div>
  );
}

function FighterPanel({
  mon,
  team,
  label,
  mirrored,
}: {
  mon: BattlePokemonDTO;
  team: BattlePokemonDTO[];
  label: string;
  mirrored?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-edge bg-surface p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wide text-ink-dim">{label}</span>
        <TeamDots pokemons={team} />
      </div>
      <div className={`mt-2 flex items-center gap-4 ${mirrored ? "flex-row-reverse" : ""}`}>
        {mon.spriteUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- sprite da PokéAPI
          <img
            src={mon.spriteUrl}
            alt={mon.name}
            className={`h-28 w-28 object-contain ${mon.fainted ? "opacity-30 grayscale" : ""}`}
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-extrabold uppercase">
            {mon.name} {mon.fainted && <span className="text-bad">✗</span>}
          </p>
          <div className="my-1 flex gap-1">
            {mon.types.map((t) => (
              <TypeBadge key={t} type={t} small />
            ))}
          </div>
          <HpBar current={mon.currentHp} max={mon.maxHp} />
          <p className="mt-1 text-xs tabular-nums text-ink-dim">
            {mon.currentHp} / {mon.maxHp} HP
          </p>
        </div>
      </div>
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
  const [showSwitchMenu, setShowSwitchMenu] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stateRef = useRef<{ turnNumber: number; status: string } | null>(null);

  const loadFullState = useCallback(async () => {
    const res = await fetch(`/api/battle/${params.id}`);
    if (!res.ok) return;
    const data: BattleDTO = await res.json();
    setBattle(data);
    setShowSwitchMenu(false);
    setWaiting(false);
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
    return <p className="pt-16 text-center text-ink-dim">Carregando partida...</p>;
  }

  const myUserId = session.user.id;
  const me = battle.participants.find((p) => p.userId === myUserId)!;
  const opponent = battle.participants.find((p) => p.userId !== myUserId)!;
  const myActive = me.pokemons.find((p) => p.slot === me.activeSlot)!;
  const oppActive = opponent.pokemons.find((p) => p.slot === opponent.activeSlot)!;
  const needsSwitch = myActive.fainted;
  const survivors = me.pokemons.filter((p) => !p.fainted && p.slot !== me.activeSlot);

  // "A"/"B" nos eventos são atribuídos por ordenação determinística de userId
  // (ver lib/battle/resolve.ts)
  const [sideAUserId] = battle.participants.map((p) => p.userId).sort();
  const mySide: "A" | "B" = myUserId === sideAUserId ? "A" : "B";

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
      setShowSwitchMenu(false);
      setWaiting(stillSameTurn && data.status === "IN_PROGRESS");
      stateRef.current = { turnNumber: data.currentTurn, status: data.status };
    } finally {
      setSubmitting(false);
    }
  };

  const lastLog = battle.turnLogs[0];
  const isOver = battle.status !== "IN_PROGRESS";
  const iWon = isOver && battle.winnerId === myUserId;

  return (
    <div className="pt-8">
      <p className="mb-4 text-center text-sm font-bold uppercase tracking-widest text-ink-dim">
        Turno {battle.currentTurn}
      </p>

      {isOver && (
        <div className="mb-6 flex flex-col items-center gap-3 rounded-2xl border border-edge bg-surface p-6 text-center">
          <p className={`text-2xl font-extrabold ${iWon ? "text-ok" : "text-bad"}`}>
            {battle.status === "ABANDONED"
              ? iWon ? "Vitória por W.O. — oponente abandonou" : "Derrota por abandono"
              : iWon ? "Você venceu! 🏆" : "Você perdeu."}
          </p>
          <button
            onClick={() => router.push("/battle")}
            className="rounded-xl bg-poke px-5 py-2.5 font-bold text-white hover:bg-poke-dark cursor-pointer border-0 transition-colors"
          >
            Nova partida
          </button>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <FighterPanel mon={oppActive} team={opponent.pokemons} label="Oponente" mirrored />
        <FighterPanel mon={myActive} team={me.pokemons} label="Você" />
      </div>

      {lastLog && (
        <div className="mt-4 rounded-2xl border border-edge bg-surface-2/60 p-4 text-sm">
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-dim">
            Turno {lastLog.turnNumber}
          </p>
          {lastLog.events.map((e, i) => (
            <p key={i} className="text-ink-dim">
              {e.type === "switch" &&
                `${e.side === mySide ? "Você trocou" : "Oponente trocou"} para ${e.pokemonName}`}
              {e.type === "attack" &&
                (e.missed ? (
                  <>
                    <b className="capitalize text-ink">{e.moveName}</b> errou!
                  </>
                ) : (
                  <>
                    <b className="capitalize text-ink">{e.moveName}</b>: {e.damage} de dano
                    {e.isCrit && <span className="text-gold"> · crítico!</span>}
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

      {!isOver && (
        <div className="mt-6">
          {error && <p className="mb-2 text-sm text-bad">{error}</p>}

          {waiting ? (
            <div className="flex items-center justify-center gap-2 rounded-2xl border border-edge bg-surface p-6 text-ink-dim">
              <span className="h-2 w-2 animate-ping rounded-full bg-poke" />
              Aguardando a jogada do oponente...
            </div>
          ) : needsSwitch || showSwitchMenu ? (
            <>
              <p className="mb-2 font-bold">
                {needsSwitch ? "Seu pokémon desmaiou — escolha o substituto:" : "Trocar para:"}
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {survivors.map((p) => (
                  <button
                    key={p.id}
                    disabled={submitting}
                    onClick={() => submitAction({ actionType: "SWITCH", switchToSlot: p.slot })}
                    className="flex items-center gap-2 rounded-xl border border-edge bg-surface p-2 text-left hover:border-ink-dim disabled:opacity-50 cursor-pointer transition-colors"
                  >
                    {p.spriteUrl && (
                      // eslint-disable-next-line @next/next/no-img-element -- sprite da PokéAPI
                      <img src={p.spriteUrl} alt={p.name} className="h-10 w-10 object-contain" />
                    )}
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold uppercase">{p.name}</span>
                      <span className="text-xs tabular-nums text-ink-dim">
                        {p.currentHp}/{p.maxHp} HP
                      </span>
                    </span>
                  </button>
                ))}
              </div>
              {!needsSwitch && (
                <button
                  onClick={() => setShowSwitchMenu(false)}
                  className="mt-3 text-sm text-ink-dim underline cursor-pointer bg-transparent border-0"
                >
                  Cancelar
                </button>
              )}
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                {myActive.moves.map((move, i) => (
                  <button
                    key={move.id + "-" + i}
                    disabled={submitting}
                    onClick={() => submitAction({ actionType: "MOVE", moveSlot: i })}
                    className="rounded-xl border border-edge bg-surface p-3 text-left hover:border-ink-dim disabled:opacity-50 cursor-pointer transition-colors"
                    style={{ borderLeftColor: typeColor(move.type), borderLeftWidth: 4 }}
                  >
                    <span className="block font-bold uppercase">{move.name.replace(/-/g, " ")}</span>
                    <span className="text-xs text-ink-dim">
                      {move.type} · poder {move.power ?? "—"} · precisão {move.accuracy ?? 100}%
                    </span>
                  </button>
                ))}
              </div>
              {survivors.length > 0 && (
                <button
                  onClick={() => setShowSwitchMenu(true)}
                  disabled={submitting}
                  className="mt-3 text-sm text-ink-dim underline cursor-pointer bg-transparent border-0 disabled:opacity-50"
                >
                  Trocar de pokémon
                </button>
              )}
            </>
          )}

          {submitting && <p className="mt-2 text-sm text-ink-dim">Enviando...</p>}
        </div>
      )}
    </div>
  );
}
