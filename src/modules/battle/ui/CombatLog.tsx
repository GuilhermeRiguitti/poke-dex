"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import TurnClock from "./TurnClock";
import { duelLogMark, opponentStatusView, type DuelLogLine } from "./battleView";

// O PAINEL DA ESQUERDA: o estado do round no cabeçalho e o relatório de combate
// no corpo. Um frame só, e não quatro peças flutuando soltas na quina — o
// jogador olhava pra "Rodada 3", pro relógio, pro "oponente pronto" e pro feed
// em quatro lugares diferentes, cada um com seu fundo, todos por cima do palco.
//
// A ordem do cabeçalho é a ordem em que a pergunta aparece: em que rodada estou,
// quanto tempo tenho, e o oponente já jogou.
//
// A linha do feed já vem estruturada do battleView (etiqueta, ação, dano) —
// aqui nada é adivinhado a partir do texto. O dano fica numa coluna à direita,
// alinhado, porque é o número que o jogador procura quando confere a troca de
// golpes.

const TONE_CLASS: Record<ReturnType<typeof duelLogMark>["tone"], string> = {
  flare: "text-flare",
  bad: "text-bad",
  dim: "text-ink-dim",
  energy: "text-energy",
  gold: "text-gold",
};

const STATUS_CLASS = {
  bad: "text-bad",
  ok: "text-ok",
  dim: "text-ink-dim",
} as const;

function ActorTag({ actor }: { actor: "me" | "opp" }) {
  return (
    <span className="feed-tag" data-actor={actor}>
      {actor === "me" ? "Você" : "Oponente"}
    </span>
  );
}

export default function CombatLog({
  lines,
  round,
  isOver,
  turnEndsInMs,
  turnTimeoutMs,
  oppAbsentMs,
  opponentReady,
}: {
  lines: DuelLogLine[];
  round: number;
  /** partida encerrada: sem relógio e sem estado do oponente pra contar */
  isOver: boolean;
  turnEndsInMs: number;
  turnTimeoutMs: number;
  oppAbsentMs: number | null;
  opponentReady: boolean;
}) {
  const shown = lines.slice(-24);
  const endRef = useRef<HTMLDivElement>(null);
  const lastKey = shown.at(-1)?.key ?? null;
  const status = opponentStatusView({ oppAbsentMs, opponentReady });

  // o feed nasce no fim: a linha nova é a que importa
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [lastKey]);

  return (
    <div className="hud-panel feed-panel w-full" data-side="me">
      {/* barra de cima: rodada · relógio · saída */}
      <header className="feed-bar flex items-center gap-2 px-2.5 py-1.5">
        <span className="font-title text-xs uppercase tracking-wider text-ink">Rodada {round}</span>
        <span className="ml-auto">
          {!isOver && (
            // key por round: o relógio remonta a cada rodada e já nasce no valor
            // do servidor, sem esperar o primeiro tique.
            <TurnClock
              key={round}
              turnEndsInMs={turnEndsInMs}
              turnTimeoutMs={turnTimeoutMs}
              running={!isOver}
              bare
            />
          )}
        </span>
        {/* A ÚNICA saída da arena enquanto a partida corre — a sala é tela cheia
            e não tem navbar. Não abandona nada por si: quem some é declarado
            ausente pelo servidor (presence), como sempre foi. */}
        <Link
          href="/battle"
          title="Sair da arena — a partida continua e você pode perder por ausência"
          className="shrink-0 border border-edge px-1.5 py-px font-title text-[9px] uppercase tracking-widest text-ink-dim transition-colors hover:border-bad hover:text-bad"
        >
          Sair
        </Link>
      </header>

      {/* sub-barra: o que o outro lado está fazendo + o pulso do feed */}
      <div className="feed-substrip flex items-center justify-between gap-2 px-2.5 py-1">
        <span className={`font-title text-[10px] uppercase tracking-widest ${STATUS_CLASS[status.tone]}`}>
          {isOver ? "partida encerrada" : status.text}
        </span>
        <span className="flex shrink-0 items-center gap-1 font-title text-[9px] uppercase tracking-widest text-energy">
          <span className="feed-live" aria-hidden />
          Ao vivo
        </span>
      </div>

      {/* A altura é FIXA, não `max-h`: com altura variável o feed crescia linha a
          linha e empurrava a coluna inteira, então a placa de HP dançava na tela
          a cada turno. Fixo, quem se move é só o scroll interno. */}
      <div className="feed-scroll h-44 overflow-y-auto px-2 py-1.5 text-[13px] leading-tight">
        {shown.length === 0 ? (
          <p className="px-0.5 py-1 text-ink-dim">A batalha vai começar…</p>
        ) : (
          <ul className="space-y-px">
            {shown.map((l, i) => {
              const mark = duelLogMark(l);
              const last = i === shown.length - 1;
              return (
                <li
                  key={l.key}
                  className={`feed-line ${last ? "combat-line-new" : ""}`}
                  data-round={l.kind === "round" || undefined}
                  data-last={last || undefined}
                >
                  {l.kind === "round" ? (
                    <span className="feed-round font-title text-[10px] uppercase tracking-[0.2em] text-ink-dim">
                      {l.text}
                    </span>
                  ) : (
                    <>
                      <span className={`shrink-0 text-xs leading-5 ${TONE_CLASS[mark.tone]}`} aria-hidden>
                        {mark.glyph}
                      </span>
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
                      {l.damage != null && (
                        <span className="shrink-0 font-title text-sm leading-5 text-bad tabular-nums">
                          −{l.damage}
                        </span>
                      )}
                    </>
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
