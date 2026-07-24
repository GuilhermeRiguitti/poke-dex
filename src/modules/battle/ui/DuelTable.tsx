"use client";

import { useEffect, useRef, useState } from "react";
import TypeBadge from "@/src/components/TypeBadge";
import { typeColor } from "@/src/lib/typeColors";
import type { DuelCardView, DuelMonView, DuelTurnFx, DuelView, PartyMemberView } from "./battleView";

// A mesa do duelo, em HTML. Só desenho + os cliques de carta; a REGRA de
// apresentação (quem lunga, quem treme, qual número flutua) é pura e mora em
// battleView.ts (DuelTurnFx). Aqui é só a costura do movimento: comparamos o
// turnNumber do fx pra disparar a animação uma vez, e a mão é um leque de
// cartas de carteado.

// ── Barra de HP ────────────────────────────────────────────────────────────
function HpBar({ mon }: { mon: DuelMonView }) {
  const tone = mon.hpPct > 50 ? "bg-ok" : mon.hpPct > 20 ? "bg-warn" : "bg-bad";
  return (
    <div className="w-full">
      <div className="mb-1 flex items-end justify-between gap-2">
        <span className="font-title text-sm uppercase tracking-wide">{mon.name}</span>
        <span className="lv-badge">
          <span>Lv {mon.level}</span>
        </span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full border border-edge bg-panel-2">
        <div className={`h-full ${tone} transition-[width] duration-500`} style={{ width: `${mon.hpPct}%` }} />
      </div>
      <div className="mt-0.5 text-right text-xs font-bold text-ink-dim">
        {mon.currentHp}/{mon.maxHp}
      </div>
    </div>
  );
}

// Texto que flutua sobre quem sofreu a ação (dano, erro, imune, hesitou).
function floaterFor(fx: DuelTurnFx | null, side: "me" | "opp"): { text: string; cls: string } | null {
  if (!fx) return null;
  if (fx.kind === "hesitate" && fx.actor === side) {
    return { text: "HESITOU", cls: "text-ink-dim" };
  }
  if (fx.kind === "attack" && fx.target === side) {
    if (fx.missed) return { text: "ERROU", cls: "text-ink-dim" };
    if (fx.effectiveness === 0) return { text: "IMUNE", cls: "text-ink-dim" };
    const cls = fx.isCrit ? "text-gold" : fx.effectiveness > 1 ? "text-bad" : "text-ink";
    return { text: `-${fx.damage}`, cls };
  }
  return null;
}

function effBannerFor(fx: DuelTurnFx | null, side: "me" | "opp"): string | null {
  if (!fx || fx.kind !== "attack" || fx.target !== side || fx.missed || fx.effectiveness <= 0) return null;
  if (fx.effectiveness > 1) return "Super eficaz!";
  if (fx.effectiveness < 1) return "Pouco eficaz";
  return null;
}

// ── Lutador (sprite + HP + FX) ──────────────────────────────────────────────
function Fighter({ mon, side, fx, nonce }: { mon: DuelMonView; side: "me" | "opp"; fx: DuelTurnFx | null; nonce: number }) {
  const isActor = fx?.actor === side && fx?.kind === "attack";
  const isTarget = fx?.kind === "attack" && fx?.target === side;
  const flashing = isTarget && !fx!.missed && fx!.effectiveness > 0;

  const lunge = isActor ? (side === "me" ? "fx-lunge-up" : "fx-lunge-down") : "";
  const shake = flashing ? "fx-hit" : "";

  const floater = floaterFor(fx, side);
  const banner = effBannerFor(fx, side);
  const accent = side === "opp" ? "text-enemy" : "text-energy";

  return (
    <div className={`flex items-center gap-4 ${side === "opp" ? "flex-row-reverse text-right" : ""}`}>
      <div className="flex flex-col items-center">
        <div className="relative">
          {/* plataforma (sombra elíptica pra dar chão) */}
          <div className="absolute -bottom-1 left-1/2 h-3 w-24 -translate-x-1/2 rounded-[50%] bg-black/45 blur-[3px]" />

          <div className={`relative ${lunge} ${shake}`}>
            {mon.spriteUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- sprite da PokéAPI (host externo)
              <img
                src={mon.spriteUrl}
                alt={mon.name}
                className={`h-28 w-28 object-contain drop-shadow-[0_6px_10px_rgba(0,0,0,.5)] ${
                  mon.fainted ? "opacity-30 grayscale" : "sprite-idle"
                }`}
              />
            )}
            {flashing && (
              <div
                key={`flash-${nonce}`}
                className="fx-flash pointer-events-none absolute inset-0 rounded-full"
                style={{ background: "radial-gradient(circle, rgba(255,92,92,.9), transparent 68%)" }}
              />
            )}
          </div>

          {/* número de dano / rótulo que flutua */}
          {floater && (
            <div
              key={`dmg-${nonce}`}
              className={`dmg-float pointer-events-none absolute left-1/2 top-1 z-20 font-title text-3xl tracking-wide drop-shadow-[0_2px_3px_rgba(0,0,0,.7)] ${floater.cls}`}
            >
              {floater.text}
              {fx?.kind === "attack" && fx.target === side && fx.isCrit && !fx.missed && (
                <span className="ml-1 align-super text-xs text-gold">CRIT</span>
              )}
            </div>
          )}

          {/* selo de efetividade */}
          {banner && (
            <div
              key={`eff-${nonce}`}
              className="fx-pop pointer-events-none absolute -top-3 left-1/2 z-20 whitespace-nowrap font-title text-sm uppercase tracking-wider text-flare drop-shadow-[0_2px_3px_rgba(0,0,0,.7)]"
            >
              {banner}
            </div>
          )}
        </div>

        <div className={`flex gap-1 ${side === "opp" ? "flex-row-reverse" : ""}`}>
          {mon.types.map((t) => (
            <TypeBadge key={t} type={t} small />
          ))}
        </div>
      </div>
      <div className="w-52 max-w-[45vw]">
        <span className={`font-title text-[10px] uppercase tracking-widest ${accent}`}>
          {side === "opp" ? "Oponente" : "Você"}
        </span>
        <HpBar mon={mon} />
      </div>
    </div>
  );
}

// ── Carta da mão (leque) ────────────────────────────────────────────────────
function HandCard({
  card,
  fan,
  locked,
  casting,
  onPlay,
}: {
  card: DuelCardView;
  fan: { tx: number; ty: number; rot: number; z: number };
  locked: boolean;
  casting: boolean;
  onPlay: () => void;
}) {
  const disabled = locked || card.disabled;
  const ppPct = card.maxPp > 0 ? (card.currentPp / card.maxPp) * 100 : 0;

  return (
    <button
      disabled={disabled}
      onClick={onPlay}
      style={{
        ["--tx" as string]: `${fan.tx}px`,
        ["--ty" as string]: `${fan.ty}px`,
        ["--rot" as string]: `${fan.rot}deg`,
        ["--cw" as string]: "118px",
        ["--type-c" as string]: typeColor(card.type),
        zIndex: casting ? 70 : fan.z,
      }}
      className={`hand-card ${card.disabled ? "hand-card--dead" : ""} ${casting ? "hand-card--cast" : ""}`}
      aria-label={`${card.name.replace(/-/g, " ")} · ${card.type} · ${card.currentPp} de ${card.maxPp} PP`}
    >
      <div
        className="clip-card relative flex h-[164px] w-full flex-col overflow-hidden border border-edge bg-panel-2 text-left shadow-[0_8px_16px_rgba(0,0,0,.45)]"
        style={{ borderTopWidth: 3, borderTopColor: "var(--type-c)" }}
      >
        {/* lavagem de cor por tipo */}
        <div
          className="pointer-events-none absolute inset-0 opacity-25"
          style={{ background: "radial-gradient(120% 75% at 50% 0, var(--type-c), transparent 70%)" }}
        />

        <div className="relative flex h-full flex-col p-2">
          <span className="line-clamp-2 min-h-[26px] font-title text-[11px] uppercase capitalize leading-tight tracking-wide text-ink">
            {card.name.replace(/-/g, " ")}
          </span>

          <div className="mt-1.5 flex justify-center">
            <TypeBadge type={card.type} small />
          </div>

          <div className="mt-auto flex items-end justify-between">
            <span className="font-title text-lg leading-none" style={{ color: "var(--type-c)" }}>
              {card.power ?? "—"}
              <span className="ml-0.5 text-[9px] text-ink-dim">PW</span>
            </span>
            <span className="text-[10px] font-bold text-ink-dim">
              {card.currentPp}/{card.maxPp} PP
            </span>
          </div>

          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-panel">
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{ width: `${ppPct}%`, background: "var(--type-c)" }}
            />
          </div>
        </div>
      </div>
    </button>
  );
}

// ── Time do oponente (pips: vivo / desmaiado) ───────────────────────────────
// Só marcadores — não revela espécie nem cartas das reservas ainda não vistas.
function OppPips({ party }: { party: PartyMemberView[] }) {
  return (
    <div className="flex gap-1">
      {party.map((m) => (
        <span
          key={m.slot}
          title={m.fainted ? "Nocauteado" : "Em jogo"}
          className={`h-2.5 w-2.5 rounded-full border ${
            m.fainted ? "border-edge bg-panel-2" : m.isActive ? "border-enemy bg-enemy" : "border-enemy/60 bg-enemy/40"
          }`}
        />
      ))}
    </div>
  );
}

// ── Meu time (barra de troca) ───────────────────────────────────────────────
function PartyBar({
  party,
  disabled,
  onSwitch,
}: {
  party: PartyMemberView[];
  disabled: boolean;
  onSwitch: (slot: number) => void;
}) {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {party.map((m) => {
        const clickable = m.canSwitchTo && !disabled;
        const tone = m.hpPct > 50 ? "bg-ok" : m.hpPct > 20 ? "bg-warn" : "bg-bad";
        return (
          <button
            key={m.slot}
            disabled={!clickable}
            onClick={() => onSwitch(m.slot)}
            title={m.name.replace(/-/g, " ")}
            aria-label={`Trocar para ${m.name.replace(/-/g, " ")}`}
            className={`relative flex w-14 flex-col items-center rounded-md border p-1 transition-colors ${
              m.isActive
                ? "border-energy bg-panel-2"
                : clickable
                  ? "cursor-pointer border-edge bg-panel hover:border-energy"
                  : "border-edge bg-panel opacity-60"
            }`}
          >
            {m.spriteUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- sprite da PokéAPI (host externo)
              <img
                src={m.spriteUrl}
                alt={m.name}
                className={`h-9 w-9 object-contain ${m.fainted ? "opacity-30 grayscale" : ""}`}
              />
            )}
            <div className="h-1 w-full overflow-hidden rounded-full bg-panel-2">
              <div className={`h-full ${tone}`} style={{ width: `${m.hpPct}%` }} />
            </div>
            {m.isActive && (
              <span className="absolute -top-1 -right-1 rounded-full bg-energy px-1 text-[8px] font-bold text-bg">
                ●
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Mesa ────────────────────────────────────────────────────────────────────
export default function DuelTable({
  view,
  submitting,
  onPlayCard,
  onSwitch,
}: {
  view: DuelView;
  submitting: boolean;
  onPlayCard: (cardSlot: number) => void;
  onSwitch: (targetSlot: number) => void;
}) {
  const locked = submitting || !view.canPlay;
  const forcedSwitch = view.mode === "forcedSwitch";

  // FX da última ação: dispara UMA vez quando o turnNumber muda. O primeiro
  // mount só registra (não re-anima o histórico ao (re)abrir a sala).
  const [fx, setFx] = useState<DuelTurnFx | null>(null);
  const [nonce, setNonce] = useState(0);
  const seen = useRef<number | null>(null);

  useEffect(() => {
    const tn = view.fx?.turnNumber ?? null;
    if (seen.current === null) {
      seen.current = tn;
      return;
    }
    if (tn === null || tn === seen.current) return;
    seen.current = tn;
    setFx(view.fx);
    setNonce((n) => n + 1);
    const t = setTimeout(() => setFx(null), 1100);
    return () => clearTimeout(t);
  }, [view.fx]);

  // carta em vôo (independe da rede: a animação sempre completa)
  const [casting, setCasting] = useState<number | null>(null);
  const castTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (castTimer.current && clearTimeout(castTimer.current)), []);

  function handlePlay(slot: number) {
    if (locked) return;
    setCasting(slot);
    if (castTimer.current) clearTimeout(castTimer.current);
    castTimer.current = setTimeout(() => setCasting(null), 520);
    onPlayCard(slot);
  }

  const shakeScreen = fx && !fx.missed && (fx.isCrit || fx.fainted) ? "screen-shake" : "";

  // Turno simultâneo: nunca é "a vez de alguém". O que a faixa comunica é o
  // estado da MINHA escolha — e, quando já escolhi, que o oponente ainda está
  // decidindo. Nada aqui revela QUAL carta ele escolheu (o DTO nem carrega).
  const banner = view.isOver
    ? null
    : forcedSwitch
      ? { text: "Escolha um substituto", cls: "text-flare animate-pulse" }
      : view.waitingOpponent
        ? { text: "Aguardando oponente...", cls: "text-ink-dim animate-pulse" }
        : { text: "Escolha sua carta", cls: "text-flare" };

  // leque: cada carta gira/desloca em arco a partir do centro
  const n = view.cards.length;
  const mid = (n - 1) / 2;
  const SPREAD = 6;
  const GAP = 62;
  const ARC = 9;

  return (
    <div className={`flex h-full flex-col gap-2 p-3 sm:p-4 ${shakeScreen}`}>
      <div className="flex items-center justify-between">
        <span className="plate border border-edge bg-panel-2 px-3 py-1">
          <span className="plate-inner font-title text-xs uppercase tracking-wider">Rodada {view.round}</span>
        </span>
        {banner && <span className={`font-title text-lg uppercase tracking-wider ${banner.cls}`}>{banner.text}</span>}
        {/* "já escolheu" — a única coisa que o servidor conta sobre a jogada do
            oponente antes do turno resolver. Qual carta, ninguém sabe. */}
        <span
          className={`font-title text-[10px] uppercase tracking-widest ${
            view.opponentReady ? "text-ok" : "text-ink-dim"
          }`}
        >
          {view.isOver ? "" : view.opponentReady ? "● oponente pronto" : "○ oponente escolhendo"}
        </span>
      </div>

      {/* Campo */}
      <div className="clip-card relative flex flex-1 flex-col justify-between overflow-hidden border border-edge bg-panel p-6">
        {/* glow ambiente do campo */}
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(70% 45% at 78% 22%, rgba(255,92,92,.08), transparent 60%), radial-gradient(70% 45% at 22% 82%, rgba(35,201,255,.08), transparent 60%)",
          }}
        />
        <div className="relative mb-1 flex justify-end">
          <OppPips party={view.oppParty} />
        </div>
        <div className="relative">
          <Fighter mon={view.opp} side="opp" fx={fx} nonce={nonce} />
        </div>
        <div className="relative my-2 h-px bg-gradient-to-r from-transparent via-edge to-transparent" />
        <div className="relative">
          <Fighter mon={view.me} side="me" fx={fx} nonce={nonce} />
        </div>
      </div>

      {/* Log */}
      <div className="clip-card h-24 overflow-y-auto border border-edge bg-panel p-3 text-sm">
        {view.logLines.length === 0 ? (
          <p className="text-ink-dim">A batalha vai começar...</p>
        ) : (
          <ul className="space-y-1">
            {view.logLines.slice(-6).map((l) => (
              <li key={l.key} className={l.text.startsWith("—") ? "font-title text-xs uppercase text-ink-dim" : ""}>
                {l.text}
              </li>
            ))}
          </ul>
        )}
      </div>

      {forcedSwitch ? (
        // Troca forçada: sem cartas, o time vira o único caminho de ação.
        <div className="flex flex-col items-center gap-3 pt-6">
          <p className="font-title text-sm uppercase tracking-wider text-flare">
            {view.me.name.replace(/-/g, " ")} desmaiou — escolha o próximo
          </p>
          <PartyBar party={view.myParty} disabled={submitting} onSwitch={onSwitch} />
        </div>
      ) : (
        <>
          {/* Mão de cartas (leque) */}
          <div className={`flex justify-center pt-8 transition-opacity ${locked && casting === null ? "opacity-60" : ""}`}>
            <div className="hand h-[172px]" style={{ width: `${GAP * (n - 1) + 130}px`, maxWidth: "96vw" }}>
              {view.cards.map((c, i) => {
                const off = i - mid;
                const fan = {
                  tx: off * GAP,
                  ty: Math.pow(Math.abs(off), 1.35) * ARC,
                  rot: off * SPREAD,
                  z: 10 + i,
                };
                return (
                  <HandCard
                    key={c.slot}
                    card={c}
                    fan={fan}
                    locked={locked}
                    casting={casting === c.slot}
                    onPlay={() => handlePlay(c.slot)}
                  />
                );
              })}
            </div>
          </div>

          {/* Meu time — troca voluntária (gasta o turno) */}
          <div className="flex flex-col items-center gap-1 pt-1">
            <span className="font-title text-[10px] uppercase tracking-widest text-ink-dim">
              {view.canSwitch ? "Trocar (gasta o turno)" : "Seu time"}
            </span>
            <PartyBar party={view.myParty} disabled={locked} onSwitch={onSwitch} />
          </div>
        </>
      )}
    </div>
  );
}
