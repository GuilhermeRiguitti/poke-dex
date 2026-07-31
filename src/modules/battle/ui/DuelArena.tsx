"use client";

import { Component, type ReactNode, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import TypeBadge from "@/src/components/TypeBadge";
import MoveCommandBar from "./MoveCommandBar";
import type { DuelMonView, DuelTurnFx, DuelView, PartyMemberView } from "./battleView";

// A ARENA da batalha: palco 3D (three.js/R3F, lazy) atrás + overlays HTML na
// frente (HP, dano, times) + barra de comando dos golpes + relatório interativo.
// A regra de apresentação continua pura em battleView.ts (DuelTurnFx). Aqui é
// costura + o movimento. Se o WebGL falhar, cai no fallback de sprites HTML.

const DuelStage3D = dynamic(() => import("./DuelStage3D"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 grid place-items-center text-xs text-ink-dim">Montando arena…</div>,
});

// ── fallback HTML se o 3D falhar (WebGL indisponível) ───────────────────────
function StageFallbackSprites({ me, opp }: { me: DuelMonView; opp: DuelMonView }) {
  const one = (mon: DuelMonView, side: "me" | "opp") => (
    <div className={`absolute left-1/2 -translate-x-1/2 ${side === "opp" ? "top-6" : "bottom-6"}`}>
      <div className="absolute -bottom-1 left-1/2 h-3 w-24 -translate-x-1/2 rounded-[50%] bg-black/45 blur-[3px]" />
      {mon.spriteUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- sprite da PokéAPI
        <img
          src={mon.spriteUrl}
          alt={mon.name}
          className={`h-28 w-28 object-contain drop-shadow-[0_6px_10px_rgba(0,0,0,.5)] ${mon.fainted ? "opacity-30 grayscale" : "sprite-idle"}`}
        />
      )}
    </div>
  );
  return (
    <div className="absolute inset-0">
      {one(opp, "opp")}
      {one(me, "me")}
    </div>
  );
}

// Error boundary: se o R3F/WebGL estourar, mostramos os sprites HTML — o jogo
// nunca fica sem o campo (a batalha funciona igual, sem o 3D).
class StageBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

// ── barra de HP (overlay) ───────────────────────────────────────────────────
function HpBar({ mon, side }: { mon: DuelMonView; side: "me" | "opp" }) {
  const tone = mon.hpPct > 50 ? "bg-ok" : mon.hpPct > 20 ? "bg-warn" : "bg-bad";
  const accent = side === "opp" ? "text-enemy" : "text-energy";
  return (
    <div className="w-56 max-w-[46vw] rounded-md border border-edge bg-panel/85 p-2 backdrop-blur-sm">
      <div className="flex items-end justify-between gap-2">
        <span className="font-title text-sm uppercase tracking-wide">{mon.name.replace(/-/g, " ")}</span>
        <span className="lv-badge">
          <span>Lv {mon.level}</span>
        </span>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <span className={`font-title text-[9px] uppercase tracking-widest ${accent}`}>
          {side === "opp" ? "Oponente" : "Você"}
        </span>
        <div className="h-2.5 flex-1 overflow-hidden rounded-full border border-edge bg-panel-2">
          <div className={`h-full ${tone} transition-[width] duration-500`} style={{ width: `${mon.hpPct}%` }} />
        </div>
      </div>
      <div className="mt-0.5 text-right text-[11px] font-bold text-ink-dim">
        {mon.currentHp}/{mon.maxHp}
      </div>
      <div className="mt-1 flex gap-1">
        {mon.types.map((t) => (
          <TypeBadge key={t} type={t} small />
        ))}
      </div>
    </div>
  );
}

// texto que flutua sobre quem sofreu a ação
function floaterFor(fx: DuelTurnFx | null, side: "me" | "opp"): { text: string; cls: string; crit: boolean } | null {
  if (!fx) return null;
  if (fx.kind === "hesitate" && fx.actor === side) return { text: "HESITOU", cls: "text-ink-dim", crit: false };
  if (fx.kind === "attack" && fx.target === side) {
    if (fx.missed) return { text: "ERROU", cls: "text-ink-dim", crit: false };
    if (fx.effectiveness === 0) return { text: "IMUNE", cls: "text-ink-dim", crit: false };
    const cls = fx.isCrit ? "text-gold" : fx.effectiveness > 1 ? "text-bad" : "text-ink";
    return { text: `-${fx.damage}`, cls, crit: fx.isCrit };
  }
  return null;
}

function effBannerFor(fx: DuelTurnFx | null, side: "me" | "opp"): string | null {
  if (!fx || fx.kind !== "attack" || fx.target !== side || fx.missed || fx.effectiveness <= 0) return null;
  if (fx.effectiveness > 1) return "Super eficaz!";
  if (fx.effectiveness < 1) return "Pouco eficaz";
  return null;
}

function Floater({ fx, side, nonce }: { fx: DuelTurnFx | null; side: "me" | "opp"; nonce: number }) {
  const f = floaterFor(fx, side);
  const banner = effBannerFor(fx, side);
  if (!f && !banner) return null;
  return (
    <div className={`pointer-events-none absolute left-1/2 z-20 -translate-x-1/2 ${side === "opp" ? "top-16" : "bottom-28"}`}>
      {f && (
        <div key={`d-${nonce}`} className={`dmg-float font-title text-4xl tracking-wide drop-shadow-[0_2px_3px_rgba(0,0,0,.7)] ${f.cls}`}>
          {f.text}
          {f.crit && <span className="ml-1 align-super text-xs text-gold">CRIT</span>}
        </div>
      )}
      {banner && (
        <div key={`b-${nonce}`} className="fx-pop absolute left-1/2 top-0 -translate-x-1/2 whitespace-nowrap font-title text-sm uppercase tracking-wider text-flare drop-shadow-[0_2px_3px_rgba(0,0,0,.7)]">
          {banner}
        </div>
      )}
    </div>
  );
}

// ── times ───────────────────────────────────────────────────────────────────
function OppPips({ party }: { party: PartyMemberView[] }) {
  return (
    <div className="flex gap-1">
      {party.map((m) => (
        <span
          key={m.slot}
          title={m.fainted ? "Nocauteado" : "Em jogo"}
          className={`h-2.5 w-2.5 rounded-full border ${m.fainted ? "border-edge bg-panel-2" : m.isActive ? "border-enemy bg-enemy" : "border-enemy/60 bg-enemy/40"}`}
        />
      ))}
    </div>
  );
}

function PartyBar({ party, disabled, onSwitch }: { party: PartyMemberView[]; disabled: boolean; onSwitch: (slot: number) => void }) {
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
              m.isActive ? "border-energy bg-panel-2" : clickable ? "cursor-pointer border-edge bg-panel hover:border-energy" : "border-edge bg-panel opacity-60"
            }`}
          >
            {m.spriteUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- sprite da PokéAPI
              <img src={m.spriteUrl} alt={m.name} className={`h-9 w-9 object-contain ${m.fainted ? "opacity-30 grayscale" : ""}`} />
            )}
            <div className="h-1 w-full overflow-hidden rounded-full bg-panel-2">
              <div className={`h-full ${tone}`} style={{ width: `${m.hpPct}%` }} />
            </div>
            {m.isActive && <span className="absolute -top-1 -right-1 rounded-full bg-energy px-1 text-[8px] font-bold text-bg">●</span>}
          </button>
        );
      })}
    </div>
  );
}

// ── relatório de combate (feed interativo) ──────────────────────────────────
function iconFor(text: string): { glyph: string; cls: string } {
  if (text.startsWith("—")) return { glyph: "◆", cls: "text-ink-dim" };
  if (/Nocaute/i.test(text)) return { glyph: "☠", cls: "text-bad" };
  if (/super eficaz/i.test(text)) return { glyph: "▲", cls: "text-bad" };
  if (/pouco eficaz/i.test(text)) return { glyph: "▼", cls: "text-ink-dim" };
  if (/errou/i.test(text)) return { glyph: "✕", cls: "text-ink-dim" };
  if (/hesitou/i.test(text)) return { glyph: "…", cls: "text-ink-dim" };
  if (/enviou/i.test(text)) return { glyph: "⇄", cls: "text-energy" };
  return { glyph: "•", cls: "text-flare" };
}

function CombatFeed({ view }: { view: DuelView }) {
  const lines = view.logLines.slice(-6);
  return (
    <div className="clip-card h-24 overflow-y-auto border border-edge bg-panel/90 p-2 text-sm">
      {lines.length === 0 ? (
        <p className="text-ink-dim">A batalha vai começar…</p>
      ) : (
        <ul className="space-y-0.5">
          {lines.map((l, i) => {
            const ic = iconFor(l.text);
            const last = i === lines.length - 1;
            const isRound = l.text.startsWith("—");
            return (
              <li
                key={l.key}
                className={`flex items-start gap-1.5 ${isRound ? "font-title text-xs uppercase text-ink-dim" : ""} ${last ? "combat-line-new" : "opacity-80"}`}
              >
                <span className={`mt-px shrink-0 text-xs ${ic.cls}`}>{ic.glyph}</span>
                <span>{l.text}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ── a arena ─────────────────────────────────────────────────────────────────
export default function DuelArena({
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

  // FX da última ação: dispara UMA vez quando o turnNumber muda (não re-anima o
  // histórico ao (re)abrir a sala).
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

  const banner = view.isOver
    ? null
    : forcedSwitch
      ? { text: "Escolha um substituto", cls: "text-flare animate-pulse" }
      : view.waitingOpponent
        ? { text: "Aguardando oponente…", cls: "text-ink-dim animate-pulse" }
        : { text: "Escolha seu golpe", cls: "text-flare" };

  return (
    <div className={`flex h-full flex-col gap-2 p-3 sm:p-4 ${shakeScreen}`}>
      {/* topo: rodada + estado + oponente pronto */}
      <div className="flex items-center justify-between">
        <span className="plate border border-edge bg-panel-2 px-3 py-1">
          <span className="plate-inner font-title text-xs uppercase tracking-wider">Rodada {view.round}</span>
        </span>
        {banner && <span className={`font-title text-lg uppercase tracking-wider ${banner.cls}`}>{banner.text}</span>}
        <span className={`font-title text-[10px] uppercase tracking-widest ${view.opponentReady ? "text-ok" : "text-ink-dim"}`}>
          {view.isOver ? "" : view.opponentReady ? "● oponente pronto" : "○ oponente escolhendo"}
        </span>
      </div>

      {/* arena: palco 3D + overlays */}
      <div className="clip-card relative flex-1 overflow-hidden border border-edge bg-panel">
        <StageBoundary fallback={<StageFallbackSprites me={view.me} opp={view.opp} />}>
          <DuelStage3D
            me={{ spriteUrl: view.me.spriteUrl, fainted: view.me.fainted }}
            opp={{ spriteUrl: view.opp.spriteUrl, fainted: view.opp.fainted }}
            fx={fx}
            nonce={nonce}
          />
        </StageBoundary>

        {/* overlays HTML */}
        <div className="pointer-events-none absolute right-3 top-3 z-10 flex flex-col items-end gap-2">
          <HpBar mon={view.opp} side="opp" />
          <OppPips party={view.oppParty} />
        </div>
        <div className="pointer-events-none absolute bottom-3 left-3 z-10">
          <HpBar mon={view.me} side="me" />
        </div>
        <Floater fx={fx} side="opp" nonce={nonce} />
        <Floater fx={fx} side="me" nonce={nonce} />
      </div>

      {/* relatório de combate */}
      <CombatFeed view={view} />

      {/* ação: barra de golpes ou troca forçada */}
      {forcedSwitch ? (
        <div className="flex flex-col items-center gap-3 pt-2">
          <p className="font-title text-sm uppercase tracking-wider text-flare">
            {view.me.name.replace(/-/g, " ")} desmaiou — escolha o próximo
          </p>
          <PartyBar party={view.myParty} disabled={submitting} onSwitch={onSwitch} />
        </div>
      ) : (
        <>
          <div className={`pt-1 transition-opacity ${locked && casting === null ? "opacity-60" : ""}`}>
            <MoveCommandBar cards={view.cards} locked={locked} casting={casting} onPlay={handlePlay} />
          </div>
          <div className="flex flex-col items-center gap-1">
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
