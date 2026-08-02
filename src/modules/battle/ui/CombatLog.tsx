"use client";

import { useEffect, useRef } from "react";
import { duelLogMark, type DuelLogLine } from "./battleView";

// O RELATÓRIO DE COMBATE: o feed do duelo, flutuando no canto de baixo. A linha
// já vem estruturada do battleView (etiqueta, ação, dano) — aqui nada é
// adivinhado a partir do texto. O dano fica numa coluna à direita, alinhado,
// porque é o número que o jogador procura quando confere a troca de golpes.

const TONE_CLASS: Record<ReturnType<typeof duelLogMark>["tone"], string> = {
  flare: "text-flare",
  bad: "text-bad",
  dim: "text-ink-dim",
  energy: "text-energy",
  gold: "text-gold",
};

function ActorTag({ actor }: { actor: "me" | "opp" }) {
  return (
    <span className="feed-tag" data-actor={actor}>
      {actor === "me" ? "Você" : "Oponente"}
    </span>
  );
}

export default function CombatLog({ lines }: { lines: DuelLogLine[] }) {
  const shown = lines.slice(-24);
  const endRef = useRef<HTMLDivElement>(null);
  const lastKey = shown.at(-1)?.key ?? null;

  // o feed nasce no fim: a linha nova é a que importa
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [lastKey]);

  return (
    <div className="hud-panel" data-side="me">
      <header className="flex items-center justify-between gap-2 border-b border-edge/70 px-2.5 py-1.5">
        <span className="font-title text-[10px] uppercase tracking-widest text-ink-dim">Relatório de combate</span>
        <span className="flex items-center gap-1 font-title text-[9px] uppercase tracking-widest text-energy">
          <span className="feed-live" aria-hidden />
          Ao vivo
        </span>
      </header>

      <div className="max-h-36 overflow-y-auto px-2 py-1.5 text-sm">
        {shown.length === 0 ? (
          <p className="px-0.5 py-1 text-ink-dim">A batalha vai começar…</p>
        ) : (
          <ul className="space-y-0.5">
            {shown.map((l, i) => {
              const mark = duelLogMark(l);
              const last = i === shown.length - 1;
              return (
                <li
                  key={l.key}
                  className={`feed-line ${last ? "combat-line-new" : "opacity-75"}`}
                  data-round={l.kind === "round" || undefined}
                  data-last={last || undefined}
                >
                  <span className={`shrink-0 text-xs leading-5 ${TONE_CLASS[mark.tone]}`} aria-hidden>
                    {mark.glyph}
                  </span>
                  {l.kind === "round" ? (
                    <span className="font-title text-xs uppercase tracking-widest text-ink-dim">— {l.text} —</span>
                  ) : (
                    <span className="min-w-0 flex-1 leading-5">
                      {l.actor && <ActorTag actor={l.actor} />}
                      <span className="align-middle"> {l.text}</span>
                      {l.subject && (
                        <span className="align-middle font-semibold capitalize text-ink">
                          {" "}
                          {l.subject}
                          {l.kind === "switch" && "!"}
                        </span>
                      )}
                    </span>
                  )}
                  {l.damage != null && (
                    <span className="shrink-0 font-title text-sm leading-5 text-bad tabular-nums">−{l.damage}</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}
