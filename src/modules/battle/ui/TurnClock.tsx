"use client";

import { turnClockView } from "./battleView";
import { useTurnClock } from "./useTurnClock";

// O countdown do round, na quina de cima da arena junto da rodada.
//
// Não é enfeite: o timeout de 90s SEMPRE existiu (resolveTurn), e quem passava
// dele levava falta e perdia o turno sem nenhum aviso na tela — três faltas
// encerram a partida por abandono. O relógio é o que torna essa regra visível
// antes de doer.
//
// Ele não decide nada: é leitura. Quem resolve o turno vencido continua sendo o
// request (polling/push) e o backstop do pg_cron — aqui não há worker
// (CLAUDE.md regra 5).

const TONE = {
  calm: "var(--color-ink-dim)",
  warn: "var(--color-warn)",
  critical: "var(--color-bad)",
} as const;

export default function TurnClock({
  turnEndsInMs,
  turnTimeoutMs,
  running,
  bare = false,
}: {
  turnEndsInMs: number;
  turnTimeoutMs: number;
  /** partida em andamento (acabou → nada a contar) */
  running: boolean;
  /**
   * Sem a placa inclinada em volta. É como ele entra no cabeçalho do relatório
   * de combate: lá o frame já é do painel, e uma placa dentro de outra vira
   * moldura sobre moldura.
   */
  bare?: boolean;
}) {
  const remaining = useTurnClock(turnEndsInMs, running);
  const clock = turnClockView(remaining, turnTimeoutMs);
  const color = TONE[clock.urgency];

  return (
    <span
      role="timer"
      aria-label={clock.expired ? "Tempo do turno esgotado" : `Tempo restante do turno: ${clock.text}`}
      className={bare ? "" : "plate border border-edge bg-panel-2/85 px-3 py-1 backdrop-blur-sm"}
    >
      <span className={`flex items-center gap-2 ${bare ? "" : "plate-inner"}`}>
        <span
          className={`font-title text-xs tabular-nums tracking-wider ${clock.urgency === "critical" && !clock.expired ? "animate-pulse" : ""}`}
          style={{ color }}
        >
          {/* O tempo estourado não vira "0:00" parado: o round só resolve quando
              alguém faz request, então dizer "resolvendo" é o que está mesmo
              acontecendo. */}
          {clock.expired ? "resolvendo…" : `⏱ ${clock.text}`}
        </span>
        <span className="bar-track h-1 w-16">
          <span
            className="bar-fill block"
            style={{ width: `${clock.pct}%`, background: color }}
          />
        </span>
      </span>
    </span>
  );
}
