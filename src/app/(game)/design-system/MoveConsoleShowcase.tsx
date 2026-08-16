"use client";

import MoveCommandBar, { MoveCell } from "@/src/modules/battle/ui/MoveCommandBar";
import { DEMO_CARDS, DEMO_STATES } from "./moveConsoleDemo";

// A página do design system é SERVIDOR (regra 1). O console é cliente e recebe
// um handler, e função não atravessa a fronteira — então o no-op mora aqui, na
// menor casca cliente possível. O que se renderiza é o COMPONENTE REAL da
// batalha: se ele mudar, esta página muda junto.

export function MoveConsoleDemo() {
  return (
    <MoveCommandBar cards={DEMO_CARDS} locked={false} casting={null} energy={3} energyMax={6} onPlay={() => {}} />
  );
}

export function MoveCellGallery() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {DEMO_STATES.map((s) => (
        <figure key={s.label} className="flex flex-col gap-2">
          <figcaption className={`font-title text-[11px] uppercase tracking-[0.2em] ${s.tone}`}>
            {s.label}
          </figcaption>
          <div className="clip-card flex border border-edge bg-panel-2">
            <MoveCell card={s.card} armed={s.armed} disabled={s.card.disabled} shortcut={s.card.slot + 1} />
          </div>
        </figure>
      ))}
    </div>
  );
}
