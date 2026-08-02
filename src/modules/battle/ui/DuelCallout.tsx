import type { DuelCalloutView } from "./battleView";

// O balão de dano que aparece sobre a cabeça de quem sofreu a ação. O TEXTO já
// vem decidido por duelCalloutFor (puro, testado) — aqui só a cor e a moldura.
// Usado nos dois caminhos: ancorado no palco 3D (drei <Html>) e, se o WebGL
// falhar, sobre os sprites HTML do fallback.

const TONE: Record<DuelCalloutView["tone"], string> = {
  damage: "var(--color-ink)",
  crit: "var(--color-gold)",
  super: "var(--color-enemy)",
  weak: "var(--color-ink-dim)",
  none: "var(--color-ink-dim)",
};

export default function DuelCallout({ callout }: { callout: DuelCalloutView }) {
  const color = TONE[callout.tone];
  return (
    <div className="dmg-callout" style={{ ["--cal-c" as string]: color }}>
      <div className="flex items-baseline justify-center gap-2 whitespace-nowrap">
        <span className="font-title text-[10px] uppercase tracking-widest text-ink-dim">{callout.name}</span>
        <span className="font-title text-2xl leading-none" style={{ color }}>
          {callout.value}
        </span>
      </div>
      {callout.note && (
        <div className="mt-0.5 whitespace-nowrap font-title text-[9px] uppercase tracking-[0.18em] text-flare">
          {callout.note}
        </div>
      )}
    </div>
  );
}
