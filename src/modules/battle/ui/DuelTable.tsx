"use client";

import TypeBadge from "@/src/components/TypeBadge";
import { typeColor } from "@/src/lib/typeColors";
import type { DuelMonView, DuelView } from "./battleView";

// A mesa do duelo, em HTML (o canvas Konva do modelo simultâneo foi aposentado
// nesta fatia — dá pra repor depois, isto aqui deixa o duelo jogável). Só
// desenho + os cliques de carta; a regra de apresentação está em battleView.ts.

function HpBar({ mon }: { mon: DuelMonView }) {
  const tone = mon.hpPct > 50 ? "bg-good" : mon.hpPct > 20 ? "bg-warn" : "bg-bad";
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

function Fighter({ mon, side }: { mon: DuelMonView; side: "me" | "opp" }) {
  return (
    <div className={`flex items-center gap-4 ${side === "opp" ? "flex-row-reverse text-right" : ""}`}>
      <div className="flex flex-col items-center">
        {mon.spriteUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- sprite da PokéAPI (host externo)
          <img
            src={mon.spriteUrl}
            alt={mon.name}
            className={`h-28 w-28 object-contain drop-shadow-[0_6px_10px_rgba(0,0,0,.5)] ${mon.fainted ? "opacity-30 grayscale" : ""}`}
          />
        )}
        <div className={`flex gap-1 ${side === "opp" ? "flex-row-reverse" : ""}`}>
          {mon.types.map((t) => (
            <TypeBadge key={t} type={t} small />
          ))}
        </div>
      </div>
      <div className="w-52 max-w-[45vw]">
        <HpBar mon={mon} />
      </div>
    </div>
  );
}

export default function DuelTable({
  view,
  submitting,
  onPlayCard,
}: {
  view: DuelView;
  submitting: boolean;
  onPlayCard: (cardSlot: number) => void;
}) {
  const locked = submitting || !view.isMyTurn || view.isOver;

  const banner = view.isOver
    ? null
    : view.isMyTurn
      ? { text: "Sua vez", cls: "text-flare" }
      : { text: "Vez do oponente...", cls: "text-ink-dim animate-pulse" };

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <span className="plate border border-edge bg-panel-2 px-3 py-1">
          <span className="plate-inner font-title text-xs uppercase tracking-wider">Rodada {view.round}</span>
        </span>
        {banner && <span className={`font-title text-lg uppercase tracking-wider ${banner.cls}`}>{banner.text}</span>}
      </div>

      {/* Campo */}
      <div className="clip-card flex flex-1 flex-col justify-between border border-edge bg-panel p-6">
        <Fighter mon={view.opp} side="opp" />
        <div className="my-2 h-px bg-edge" />
        <Fighter mon={view.me} side="me" />
      </div>

      {/* Log + cartas */}
      <div className="grid gap-3 lg:grid-cols-[1fr_1.4fr]">
        <div className="clip-card h-28 overflow-y-auto border border-edge bg-panel p-3 text-sm">
          {view.logLines.length === 0 ? (
            <p className="text-ink-dim">A batalha vai começar...</p>
          ) : (
            <ul className="space-y-1">
              {view.logLines.slice(-8).map((l) => (
                <li key={l.key} className={l.text.startsWith("—") ? "font-title text-xs uppercase text-ink-dim" : ""}>
                  {l.text}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {view.cards.map((c) => (
            <button
              key={c.slot}
              onClick={() => onPlayCard(c.slot)}
              disabled={locked || c.disabled}
              style={{ ["--type-c" as string]: typeColor(c.type) }}
              className="clip-btn flex flex-col items-start gap-0.5 border-l-4 bg-panel-2 px-3 py-2 text-left transition-colors hover:bg-panel disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className="w-full truncate font-semibold capitalize" style={{ borderColor: "var(--type-c)" }}>
                {c.name.replace(/-/g, " ")}
              </span>
              <span className="flex w-full items-center justify-between text-xs text-ink-dim">
                <span className="uppercase" style={{ color: "var(--type-c)" }}>{c.type}</span>
                <span>
                  {c.power ? `${c.power}pw · ` : ""}
                  {c.currentPp}/{c.maxPp}pp
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
