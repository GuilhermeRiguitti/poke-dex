import Link from "next/link";
import { notFound } from "next/navigation";
import HpBar from "@/src/components/HpBar";
import TypeBadge from "@/src/components/TypeBadge";
import { typeColor } from "@/src/lib/typeColors";
import { getPokemonDetail } from "@/src/modules/pokedex";
import { detailView, dexNumber } from "@/src/modules/pokedex/ui/pokedexView";

export default async function PokemonDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const pokemon = await getPokemonDetail(id);
  if (!pokemon) notFound();

  const { statBars, heightMeters, weightKg, moveNames, totalMoves, accentType } =
    detailView(pokemon);
  const mainColor = typeColor(accentType);

  return (
    <div className="pt-8">
      <Link
        href="/"
        className="text-sm font-bold uppercase tracking-wide text-ink-dim hover:text-energy"
      >
        ← PokéDex
      </Link>

      <div className="mt-4 grid gap-6 md:grid-cols-[320px_1fr]">
        {/* Retrato */}
        <div
          className="card-frame clip-card animate-rise flex flex-col items-center p-6"
          style={{ "--type-c": mainColor } as React.CSSProperties}
        >
          <div className="flex w-full items-center justify-between">
            <span className="font-title text-sm tracking-wider text-ink-dim">
              {dexNumber(pokemon.id)}
            </span>
            <span className="lv-badge">
              <span>Lv 50</span>
            </span>
          </div>
          {pokemon.artworkUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- sprite da PokéAPI
            <img
              src={pokemon.artworkUrl}
              alt={pokemon.name}
              className="h-52 w-52 object-contain drop-shadow-[0_10px_14px_rgba(0,0,0,.5)]"
            />
          )}
          <h1 className="plate mt-3 px-4 py-1" style={{ backgroundColor: mainColor }}>
            <span className="plate-inner font-title text-2xl uppercase tracking-wide text-white [text-shadow:0_1px_3px_rgba(0,0,0,.5)]">
              {pokemon.name}
            </span>
          </h1>
          <div className="mt-3 flex gap-2">
            {pokemon.types.map((type) => (
              <TypeBadge key={type} type={type} />
            ))}
          </div>
          <div className="mt-5 flex gap-8 text-center">
            <div>
              <p className="font-title text-lg tracking-wide">{heightMeters} m</p>
              <p className="text-xs font-bold uppercase tracking-wider text-ink-dim">Altura</p>
            </div>
            <div>
              <p className="font-title text-lg tracking-wide">{weightKg} kg</p>
              <p className="text-xs font-bold uppercase tracking-wider text-ink-dim">Peso</p>
            </div>
          </div>
        </div>

        {/* Stats + moves */}
        <div className="flex flex-col gap-6">
          <section
            className="clip-card animate-rise border border-edge bg-panel p-6"
            style={{ animationDelay: "80ms" } as React.CSSProperties}
          >
            <h2 className="mb-4 font-title text-lg uppercase tracking-wider">Stats base</h2>
            <div className="flex flex-col gap-3">
              {statBars.map((stat) => (
                <div
                  key={stat.key}
                  className="grid grid-cols-[110px_44px_1fr] items-center gap-3 text-sm"
                >
                  <span className="font-bold uppercase tracking-wide text-ink-dim">
                    {stat.label}
                  </span>
                  <span className="font-title tracking-wider tabular-nums">{stat.value}</span>
                  <HpBar current={stat.value} max={stat.max} tone="energy" />
                </div>
              ))}
            </div>
          </section>

          <section
            className="clip-card animate-rise border border-edge bg-panel p-6"
            style={{ animationDelay: "160ms" } as React.CSSProperties}
          >
            <h2 className="mb-4 font-title text-lg uppercase tracking-wider">
              Alguns movimentos{" "}
              <span className="text-sm font-normal normal-case text-ink-dim">
                ({totalMoves} no total)
              </span>
            </h2>
            <div className="flex flex-wrap gap-2">
              {moveNames.map((move) => (
                <span
                  key={move}
                  className="clip-btn border border-edge px-3 py-1 text-xs font-bold uppercase tracking-wide text-ink-dim"
                >
                  {move}
                </span>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
