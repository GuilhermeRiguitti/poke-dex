
// Página viva de design system — usa os tokens e componentes REAIS do jogo.
// Direção: MMORPGs 2000s da Level Up × HUD futurista de Overwatch.

import HpBar from "@/src/components/HpBar";
import { PokeballIcon, SwordsIcon, CardsIcon } from "@/src/components/icons";
import TypeBadge from "@/src/components/TypeBadge";
import { TYPE_COLORS } from "@/src/lib/typeColors";

const SWATCHES = [
  { name: "bg", cls: "bg-bg", use: "fundo do jogo" },
  { name: "panel", cls: "bg-panel", use: "janelas e cards" },
  { name: "panel-2", cls: "bg-panel-2", use: "superfície elevada" },
  { name: "edge", cls: "bg-edge", use: "bordas" },
  { name: "energy", cls: "bg-energy", use: "aliado · info · foco" },
  { name: "flare", cls: "bg-flare", use: "CTA · ação" },
  { name: "gold", cls: "bg-gold", use: "level · raridade" },
  { name: "enemy", cls: "bg-enemy", use: "lado inimigo" },
  { name: "ok / warn / bad", cls: "bg-ok", use: "estados semânticos" },
];

const TYPE_SCALE = [
  { name: "Display XL", cls: "font-title text-5xl uppercase tracking-widest", spec: "Anton · 48px" },
  { name: "Título de tela", cls: "font-title text-3xl uppercase tracking-wide", spec: "Anton · 30px" },
  { name: "Nameplate", cls: "font-title text-lg uppercase tracking-wide", spec: "Anton · 18px" },
  { name: "Corpo", cls: "font-semibold text-sm", spec: "Rajdhani 600 · 14px" },
  { name: "Dados/números", cls: "font-title text-sm tracking-wider tabular-nums", spec: "Anton · tabular-nums" },
];

export default function DesignSystemPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 pb-24">
      {/* 1. Hero */}
      <section className="flex flex-col items-center gap-4 py-16 text-center">
        <PokeballIcon size={64} />
        <h1 className="plate border border-edge bg-panel px-8 py-3">
          <span className="plate-inner font-title text-5xl tracking-wide">
            POKÉ<span className="text-flare">ARENA</span>
          </span>
        </h1>
        <p className="max-w-lg text-sm font-semibold text-ink-dim">
          Design system do jogo — MMORPGs 2000s da Level Up (badges de level, barras de EXP,
          janelas de inventário) × HUD futurista de Overwatch (placas inclinadas, cantos
          chanfrados, ciano vs. laranja).
        </p>
      </section>

      {/* 2. Tipografia */}
      <Section title="Tipografia">
        <div className="flex flex-col divide-y divide-edge">
          {TYPE_SCALE.map((t) => (
            <div key={t.name} className="flex items-baseline justify-between gap-4 py-4">
              <span className={t.cls}>{t.name}</span>
              <span className="shrink-0 text-xs font-bold uppercase tracking-wider text-ink-dim">
                {t.spec}
              </span>
            </div>
          ))}
        </div>
      </Section>

      {/* 3. Cores */}
      <Section title="Cores e superfícies">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {SWATCHES.map((s) => (
            <div key={s.name} className="clip-btn border border-edge bg-panel p-3">
              <div className={`clip-btn mb-2 h-10 border border-edge ${s.cls}`} />
              <p className="font-title text-sm uppercase tracking-wide">{s.name}</p>
              <p className="text-xs font-semibold text-ink-dim">{s.use}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs font-semibold text-ink-dim">
          Cores por tipo de pokémon (badges e acentos dos cards):
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {Object.keys(TYPE_COLORS).map((t) => (
            <TypeBadge key={t} type={t} small />
          ))}
        </div>
      </Section>

      {/* 4. Componentes de jogo */}
      <Section title="Componentes de jogo">
        <p className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-dim">
          Card de pokémon — estados
        </p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <DemoCard label="Padrão" typeC={TYPE_COLORS.grass} />
          <DemoCard label="Hover (passe o mouse)" typeC={TYPE_COLORS.fire} />
          <DemoCard label="No deck" typeC={TYPE_COLORS.water} inDeck />
        </div>

        <p className="mb-3 mt-8 text-xs font-bold uppercase tracking-wider text-ink-dim">
          Botões
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <span className="clip-btn bg-flare px-4 py-2 text-sm font-bold uppercase tracking-wide text-white">
            Ação principal
          </span>
          <span className="clip-btn border border-edge px-4 py-2 text-sm font-bold uppercase tracking-wide text-ink-dim">
            Secundário
          </span>
          <span className="clip-btn bg-ok/15 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-ok">
            ✓ Capturado
          </span>
          <span className="lv-badge">
            <span>Lv 50</span>
          </span>
        </div>

        <p className="mb-3 mt-8 text-xs font-bold uppercase tracking-wider text-ink-dim">
          Barras (HP por percentual · stat em ciano)
        </p>
        <div className="flex max-w-md flex-col gap-3">
          <HpBar current={90} max={100} />
          <HpBar current={38} max={100} />
          <HpBar current={12} max={100} />
          <HpBar current={70} max={255} tone="energy" />
        </div>

        <p className="mb-3 mt-8 text-xs font-bold uppercase tracking-wider text-ink-dim">
          Ícones (SVG próprio)
        </p>
        <div className="flex items-center gap-4 text-ink-dim">
          <PokeballIcon size={32} />
          <SwordsIcon size={28} />
          <CardsIcon size={28} />
        </div>
      </Section>

      {/* 5. Motion */}
      <Section title="Motion">
        <div className="grid gap-4 sm:grid-cols-2">
          <MotionDemo name="rise" spec="350ms · ease-snap · entrada de cards">
            <div className="animate-rise clip-btn border border-edge bg-panel-2 px-4 py-2 text-sm font-bold">
              Card entrando
            </div>
          </MotionDemo>
          <MotionDemo name="playable-pulse" spec="1.8s · infinito · CTA jogável">
            <span className="clip-btn animate-playable-pulse bg-flare px-4 py-2 text-sm font-bold uppercase text-white">
              Procurar oponente
            </span>
          </MotionDemo>
          <MotionDemo name="slam + ring-burst" spec="550ms ease-snap · vitória">
            <div className="relative flex h-24 items-center justify-center overflow-hidden">
              <span className="animate-ring-burst absolute h-16 w-16 rounded-full border-4 border-gold" />
              <span className="plate animate-slam bg-gold px-6 py-1.5">
                <span className="plate-inner font-title text-2xl uppercase tracking-widest text-[#241a05]">
                  Vitória
                </span>
              </span>
            </div>
          </MotionDemo>
          <MotionDemo name="radar" spec="1.5s · infinito · fila/espera">
            <div className="relative flex h-16 w-16 items-center justify-center">
              <span className="animate-radar absolute inset-0 rounded-full border-2 border-flare" />
              <SwordsIcon size={24} className="text-flare" />
            </div>
          </MotionDemo>
        </div>
        <p className="mt-4 text-xs font-semibold text-ink-dim">
          Easing assinatura: <code>cubic-bezier(0.2, 0.9, 0.3, 1.15)</code> (leve overshoot).
          Todas as animações respeitam <code>prefers-reduced-motion</code>.
        </p>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="plate mb-6 inline-block border border-edge bg-panel px-4 py-1.5">
        <span className="plate-inner font-title text-xl uppercase tracking-wider">{title}</span>
      </h2>
      {children}
    </section>
  );
}

function DemoCard({ label, typeC, inDeck }: { label: string; typeC: string; inDeck?: boolean }) {
  return (
    <div
      data-in-deck={inDeck || undefined}
      className="card-frame clip-card flex flex-col items-center p-3 data-[in-deck]:border-flare/60"
      style={{ "--type-c": typeC } as React.CSSProperties}
    >
      <span className="self-start font-title text-xs tracking-wider text-ink-dim">#0001</span>
      <div className="my-3 flex h-16 w-16 items-center justify-center rounded-full bg-panel-2">
        <PokeballIcon size={36} />
      </div>
      <span className="font-title uppercase tracking-wide">Exemplo</span>
      <span className="mt-1 text-xs font-bold uppercase tracking-wide text-ink-dim">{label}</span>
    </div>
  );
}

function MotionDemo({
  name,
  spec,
  children,
}: {
  name: string;
  spec: string;
  children: React.ReactNode;
}) {
  return (
    <div className="clip-card border border-edge bg-panel p-4">
      <p className="font-title text-sm uppercase tracking-wider">{name}</p>
      <p className="mb-4 text-xs font-semibold text-ink-dim">{spec}</p>
      <div className="flex min-h-20 items-center justify-center">{children}</div>
    </div>
  );
}
