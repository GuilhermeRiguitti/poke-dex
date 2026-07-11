"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import TypeBadge from "@/components/TypeBadge";
import HpBar from "@/components/HpBar";
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

function TeamDots({ pokemons, tone }: { pokemons: BattlePokemonDTO[]; tone: "energy" | "enemy" }) {
  return (
    <div className="flex gap-1">
      {pokemons.map((p) => (
        <span
          key={p.id}
          title={p.name}
          className={`plate h-2.5 w-3 ${
            p.fainted ? "bg-edge" : tone === "energy" ? "bg-energy" : "bg-enemy"
          }`}
        />
      ))}
    </div>
  );
}

// Nameplate estilo versus: lado do jogador em ciano, inimigo em vermelho
function FighterPanel({
  mon,
  team,
  label,
  tone,
  mirrored,
}: {
  mon: BattlePokemonDTO;
  team: BattlePokemonDTO[];
  label: string;
  tone: "energy" | "enemy";
  mirrored?: boolean;
}) {
  const accent = tone === "energy" ? "border-t-energy" : "border-t-enemy";
  const labelColor = tone === "energy" ? "bg-energy text-bg" : "bg-enemy text-bg";
  return (
    <div className={`clip-card border border-edge border-t-[3px] bg-panel p-4 ${accent}`}>
      <div className={`flex items-center justify-between ${mirrored ? "flex-row-reverse" : ""}`}>
        <span className={`plate px-2.5 py-0.5 font-title text-xs uppercase tracking-widest ${labelColor}`}>
          <span className="plate-inner">{label}</span>
        </span>
        <TeamDots pokemons={team} tone={tone} />
      </div>
      <div className={`mt-3 flex items-center gap-4 ${mirrored ? "flex-row-reverse" : ""}`}>
        {mon.spriteUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- sprite da PokéAPI
          <img
            src={mon.spriteUrl}
            alt={mon.name}
            className={`h-28 w-28 object-contain drop-shadow-[0_8px_10px_rgba(0,0,0,.5)] ${
              mon.fainted ? "opacity-30 grayscale" : ""
            } ${mirrored ? "-scale-x-100" : ""}`}
          />
        )}
        <div className="min-w-0 flex-1">
          <div className={`flex items-center gap-2 ${mirrored ? "flex-row-reverse" : ""}`}>
            <p className="truncate font-title text-lg uppercase tracking-wide">
              {mon.name} {mon.fainted && <span className="text-bad">✗</span>}
            </p>
            <span className="lv-badge shrink-0">
              <span>Lv 50</span>
            </span>
          </div>
          <div className={`my-1.5 flex gap-1 ${mirrored ? "flex-row-reverse" : ""}`}>
            {mon.types.map((t) => (
              <TypeBadge key={t} type={t} small />
            ))}
          </div>
          <HpBar current={mon.currentHp} max={mon.maxHp} />
          {/* key força remount → animação de flash quando o HP muda */}
          <p
            key={mon.currentHp}
            className={`animate-count-flash mt-1 font-title text-sm tracking-wider tabular-nums ${
              mirrored ? "text-right" : ""
            }`}
          >
            {mon.currentHp} <span className="text-ink-dim">/ {mon.maxHp} HP</span>
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

  if (!battle || !session?.user) {
    return <p className="pt-16 text-center font-semibold text-ink-dim">Carregando partida...</p>;
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
    <div className="pt-6">
      {/* placar de turno */}
      <div className="mb-5 flex justify-center">
        <div className="plate border border-edge bg-panel px-5 py-1.5">
          <span className="plate-inner font-title tracking-[0.2em] text-ink-dim">
            TURNO{" "}
            <span key={battle.currentTurn} className="animate-count-flash inline-block text-xl text-ink tabular-nums">
              {String(battle.currentTurn).padStart(2, "0")}
            </span>
          </span>
        </div>
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
            className={`plate animate-slam px-10 py-3 ${
              iWon ? "bg-gold" : "bg-bad"
            }`}
            style={{ filter: iWon ? "drop-shadow(0 0 24px rgba(242,193,78,.5))" : "drop-shadow(0 0 24px rgba(255,92,92,.4))" }}
          >
            <span className={`plate-inner font-title text-5xl uppercase tracking-widest ${iWon ? "text-[#241a05]" : "text-white"}`}>
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

      {/* arena: inimigo × você */}
      <div className="grid gap-4 md:grid-cols-2">
        <FighterPanel mon={oppActive} team={opponent.pokemons} label="Inimigo" tone="enemy" mirrored />
        <FighterPanel mon={myActive} team={me.pokemons} label="Você" tone="energy" />
      </div>

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

      {/* comandos */}
      {!isOver && (
        <div className="mt-6">
          {error && <p className="mb-2 text-sm font-semibold text-bad">{error}</p>}

          {waiting ? (
            <div className="clip-card flex items-center justify-center gap-3 border border-edge bg-panel p-6">
              <span className="relative flex h-3 w-3">
                <span className="animate-radar absolute inline-flex h-full w-full rounded-full bg-energy" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-energy" />
              </span>
              <span className="font-title uppercase tracking-wider text-ink-dim">
                Aguardando a jogada do inimigo...
              </span>
            </div>
          ) : needsSwitch || showSwitchMenu ? (
            <>
              <p className="mb-2 font-title uppercase tracking-wide">
                {needsSwitch ? "Seu pokémon desmaiou — escolha o substituto:" : "Trocar para:"}
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {survivors.map((p) => (
                  <button
                    key={p.id}
                    disabled={submitting}
                    onClick={() => submitAction({ actionType: "SWITCH", switchToSlot: p.slot })}
                    className="clip-btn flex cursor-pointer items-center gap-2 border border-edge bg-panel p-2 text-left transition-all hover:border-energy/60 hover:bg-panel-2 active:scale-95 disabled:opacity-50"
                  >
                    {p.spriteUrl && (
                      // eslint-disable-next-line @next/next/no-img-element -- sprite da PokéAPI
                      <img src={p.spriteUrl} alt={p.name} className="h-10 w-10 object-contain" />
                    )}
                    <span className="min-w-0">
                      <span className="block truncate font-title text-sm uppercase tracking-wide">
                        {p.name}
                      </span>
                      <span className="text-xs font-bold tabular-nums text-ink-dim">
                        {p.currentHp}/{p.maxHp} HP
                      </span>
                    </span>
                  </button>
                ))}
              </div>
              {!needsSwitch && (
                <button
                  onClick={() => setShowSwitchMenu(false)}
                  className="mt-3 cursor-pointer border-0 bg-transparent text-sm font-bold uppercase tracking-wide text-ink-dim underline"
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
                    className="clip-btn cursor-pointer border border-edge bg-panel p-3 text-left transition-all hover:-translate-y-0.5 hover:bg-panel-2 active:scale-95 disabled:opacity-50"
                    style={{ borderLeftColor: typeColor(move.type), borderLeftWidth: 4 }}
                  >
                    <span className="block font-title uppercase tracking-wide">
                      {move.name.replace(/-/g, " ")}
                    </span>
                    <span className="text-xs font-bold uppercase tracking-wide text-ink-dim">
                      {move.type} · poder <span className="tabular-nums">{move.power ?? "—"}</span> ·
                      precisão <span className="tabular-nums">{move.accuracy ?? 100}%</span>
                    </span>
                  </button>
                ))}
              </div>
              {survivors.length > 0 && (
                <button
                  onClick={() => setShowSwitchMenu(true)}
                  disabled={submitting}
                  className="mt-3 cursor-pointer border-0 bg-transparent text-sm font-bold uppercase tracking-wide text-ink-dim underline disabled:opacity-50"
                >
                  Trocar de pokémon
                </button>
              )}
            </>
          )}

          {submitting && (
            <p className="mt-2 text-sm font-semibold text-ink-dim">Enviando...</p>
          )}
        </div>
      )}
    </div>
  );
}
