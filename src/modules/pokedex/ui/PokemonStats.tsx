import HpBar from "@/src/components/HpBar";
import DetailPanel from "./DetailPanel";
import type { StatBarView } from "./pokedexView";

// Os stats base. Server Component: barra é largura em CSS, não precisa de JS.
// O teto das barras (STAT_MAX) já vem resolvido em cada `StatBarView`.

export default function PokemonStats({ statBars }: { statBars: StatBarView[] }) {
  return (
    <DetailPanel title="Stats base" delayMs={80}>
      <div className="flex flex-col gap-3">
        {statBars.map((stat) => (
          <div
            key={stat.key}
            className="grid grid-cols-[110px_44px_1fr] items-center gap-3 text-sm"
          >
            <span className="font-bold uppercase tracking-wide text-ink-dim">{stat.label}</span>
            <span className="font-title tracking-wider tabular-nums">{stat.value}</span>
            <HpBar current={stat.value} max={stat.max} tone="energy" />
          </div>
        ))}
      </div>
    </DetailPanel>
  );
}
