"use client";

import TypeBadge from "@/src/layout/TypeBadge";
import { typeColor } from "@/src/lib/typeColors";
import type { DuelCardView } from "./battleView";

// A barra de comando dos golpes. As "cartas" agora são os POKÉMON (coleção), então
// aqui o golpe NÃO é uma carta — é um botão de comando com a info que decide a
// jogada: tipo (matchup), poder, classe (físico/especial/status) e PP (usos). A
// precisão só aparece quando < 100 (senão é ruído). O "porquê" de cada coisa vai
// no title (tooltip) — quem nunca jogou entende sem parede de texto.

const CLASS_META: Record<
  DuelCardView["damageClass"],
  { short: string; color: string; hint: string }
> = {
  physical: { short: "FÍS", color: "var(--color-flare)", hint: "Físico — o dano usa o Ataque" },
  special: { short: "ESP", color: "var(--color-energy)", hint: "Especial — o dano usa o Ataque Especial" },
  status: { short: "STA", color: "var(--color-ink-dim)", hint: "Status — sem dano direto; muda o campo/estado" },
};

function MoveButton({
  card,
  disabled,
  casting,
  onPlay,
}: {
  card: DuelCardView;
  disabled: boolean;
  casting: boolean;
  onPlay: () => void;
}) {
  const cls = CLASS_META[card.damageClass];
  const ppPct = card.maxPp > 0 ? (card.currentPp / card.maxPp) * 100 : 0;
  const noPp = card.currentPp <= 0;
  const name = card.name.replace(/-/g, " ");

  return (
    <button
      disabled={disabled}
      onClick={onPlay}
      style={{ ["--type-c" as string]: typeColor(card.type) }}
      className={`move-btn ${casting ? "move-btn--cast" : ""}`}
      aria-label={`${name} · ${card.type} · ${cls.short} · poder ${card.power ?? "sem dano"} · ${card.currentPp} de ${card.maxPp} PP`}
    >
      <div className="flex items-start justify-between gap-1">
        <span className="line-clamp-2 min-h-[24px] text-left font-title text-[11px] uppercase capitalize leading-tight tracking-wide text-ink">
          {name}
        </span>
        <span
          title={cls.hint}
          className="shrink-0 rounded-sm px-1 py-px font-title text-[9px] font-bold tracking-wider text-bg"
          style={{ backgroundColor: cls.color }}
        >
          {cls.short}
        </span>
      </div>

      <div className="mt-1 flex items-end justify-between">
        <div className="flex flex-col leading-none">
          <span className="font-title text-2xl leading-none" style={{ color: "var(--type-c)" }}>
            {card.power ?? "—"}
          </span>
          <span className="text-[8px] font-bold uppercase tracking-wider text-ink-dim" title="Poder do golpe">
            {card.power != null ? "Poder" : "Sem dano"}
          </span>
        </div>
        <div className="flex flex-col items-end gap-1">
          <TypeBadge type={card.type} small />
          <span
            className={`text-[10px] font-bold ${noPp ? "text-bad" : "text-ink-dim"}`}
            title="Usos restantes deste golpe"
          >
            {card.currentPp}/{card.maxPp} PP
          </span>
          {card.accuracy != null && card.accuracy < 100 && (
            <span className="text-[9px] font-semibold text-warn" title="Precisão — chance de acertar">
              {card.accuracy}% acerto
            </span>
          )}
        </div>
      </div>

      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-panel">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${ppPct}%`, background: noPp ? "var(--color-bad)" : "var(--type-c)" }}
        />
      </div>
    </button>
  );
}

export default function MoveCommandBar({
  cards,
  locked,
  casting,
  onPlay,
}: {
  cards: DuelCardView[];
  locked: boolean;
  casting: number | null;
  onPlay: (slot: number) => void;
}) {
  return (
    <div className="flex justify-center gap-2 overflow-x-auto px-1 pb-1">
      {cards.map((c) => (
        <MoveButton
          key={c.slot}
          card={c}
          disabled={locked || c.disabled}
          casting={casting === c.slot}
          onPlay={() => onPlay(c.slot)}
        />
      ))}
    </div>
  );
}
