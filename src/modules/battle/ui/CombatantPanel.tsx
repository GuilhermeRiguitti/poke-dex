import TypeBadge from "@/src/layout/TypeBadge";
import type { DuelMonView, PartyMemberView } from "./battleView";

// A placa de HP de um dos lados, flutuando sobre o palco 3D: retrato + nome +
// nível, barra de HP segmentada e os tipos. A do OPONENTE ainda carrega os
// marcadores do time dele (vivo/nocauteado) — o meu time não precisa disso aqui,
// ele está no leque de reservas.
//
// O acento (vermelho/ciano) diz de quem é a placa antes de qualquer texto.

function TeamPips({ party }: { party: PartyMemberView[] }) {
  return (
    <span className="flex items-center gap-1">
      {party.map((m) => (
        <span
          key={m.slot}
          title={m.fainted ? "Nocauteado" : m.isActive ? "Em campo" : "Na reserva"}
          data-state={m.fainted ? "down" : m.isActive ? "active" : "ready"}
          className="hud-pip"
        />
      ))}
    </span>
  );
}

export default function CombatantPanel({
  mon,
  side,
  party,
}: {
  mon: DuelMonView;
  side: "me" | "opp";
  /** só o oponente mostra o time em marcadores */
  party?: PartyMemberView[];
}) {
  const tone = mon.hpPct > 50 ? "var(--color-ok)" : mon.hpPct > 20 ? "var(--color-warn)" : "var(--color-bad)";
  const name = mon.name.replace(/-/g, " ");

  return (
    // largura vem de quem posiciona (a placa e o relatório dividem a mesma coluna)
    <div className="hud-panel w-full p-2.5" data-side={side}>
      <div className="flex items-start gap-2.5">
        <span className="hud-thumb" aria-hidden>
          {mon.spriteUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- sprite da PokéAPI
            <img src={mon.spriteUrl} alt="" className={mon.fainted ? "opacity-40 grayscale" : ""} />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-title text-lg uppercase leading-none tracking-wide">{name}</span>
            <span className="lv-badge shrink-0">
              <span>Lv {mon.level}</span>
            </span>
          </div>

          <div className="mt-1.5 flex items-center gap-2">
            <span
              className={`shrink-0 font-title text-[9px] uppercase tracking-widest ${side === "opp" ? "text-enemy" : "text-energy"}`}
            >
              {side === "opp" ? "Oponente" : "Você"}
            </span>
            <span className="bar-track h-2.5 flex-1">
              <span className="bar-fill block" style={{ width: `${mon.hpPct}%`, background: tone }} />
            </span>
            <span className="shrink-0 text-[11px] font-bold tabular-nums text-ink">
              {mon.currentHp}/{mon.maxHp}
            </span>
          </div>

          <div className="mt-1.5 flex items-center justify-between gap-2">
            <span className="flex gap-1">
              {mon.types.map((t) => (
                <TypeBadge key={t} type={t} small />
              ))}
            </span>
            {party && (
              <span className="flex items-center gap-1.5">
                <span className="font-title text-[9px] uppercase tracking-widest text-ink-dim">Time</span>
                <TeamPips party={party} />
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
