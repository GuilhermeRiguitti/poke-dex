import TypeBadge from "@/src/layout/TypeBadge";
import type { ConditionBadgeView, DuelMonView, PartyMemberView } from "./battleView";

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

// As etiquetas de estado alterado. Ficam logo abaixo da barra de HP porque é
// isso que explica o resto da placa: por que o HP caiu sem ninguém atacar, por
// que o golpe bateu menos, por que o oponente jogou primeiro. Sem elas, status
// vira dado invisível — e dado invisível o jogador lê como bug.
const CONDITION_TONE: Record<ConditionBadgeView["tone"], string> = {
  bad: "border-bad/60 bg-bad/15 text-bad",
  warn: "border-warn/60 bg-warn/15 text-warn",
  energy: "border-energy/60 bg-energy/15 text-energy",
};

function ConditionBadges({ badges }: { badges: ConditionBadgeView[] }) {
  if (badges.length === 0) return null;
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1">
      {badges.map((b) => (
        <span
          key={b.key}
          title={b.title}
          className={`rounded-sm border px-1.5 py-px font-title text-[9px] font-bold uppercase tracking-wider ${CONDITION_TONE[b.tone]}`}
        >
          {b.label}
        </span>
      ))}
    </div>
  );
}

export default function CombatantPanel({
  mon,
  side,
  party,
  energy,
  energyMax,
}: {
  mon: DuelMonView;
  side: "me" | "opp";
  /** só o oponente mostra o time em marcadores */
  party?: PartyMemberView[];
  /**
   * Energia do LADO (não do pokémon). Aparece nos DOIS painéis: é informação
   * pública, como HP e status, e é o que permite ler a ameaça — "ele tem 3, o
   * golpe grande vem agora".
   */
  energy: number;
  energyMax: number;
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

          {/* ENERGIA em pips, e não em barra contínua: o número é pequeno
              (0..6) e o que o jogador precisa é CONTAR pra comparar com o custo
              do botão, não estimar uma proporção. */}
          <div className="mt-1.5 flex items-center gap-2">
            <span className="shrink-0 font-title text-[9px] uppercase tracking-widest text-ink-dim">
              Energia
            </span>
            <span className="flex gap-1" title={`${energy} de ${energyMax} de energia`}>
              {Array.from({ length: energyMax }, (_, i) => (
                <span
                  key={i}
                  className={`block h-2 w-2 rounded-full ${i < energy ? "bg-energy" : "bg-panel"}`}
                />
              ))}
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

          <ConditionBadges badges={mon.badges} />
        </div>
      </div>
    </div>
  );
}
