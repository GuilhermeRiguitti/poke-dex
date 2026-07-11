import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchPokemon } from "@/lib/pokeapi";
import TypeBadge from "@/components/TypeBadge";
import HpBar from "@/components/HpBar";
import { typeColor } from "@/lib/typeColors";

const STAT_LABELS: Record<string, string> = {
  hp: "HP",
  attack: "Ataque",
  defense: "Defesa",
  "special-attack": "At. Especial",
  "special-defense": "Def. Especial",
  speed: "Velocidade",
};

const STAT_MAX = 255;

export default async function PokemonDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const pokemon = await fetchPokemon(id);
  if (!pokemon) notFound();

  const mainColor = typeColor(pokemon.types[0]?.type.name ?? "normal");

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
              #{String(pokemon.id).padStart(4, "0")}
            </span>
            <span className="lv-badge">
              <span>Lv 50</span>
            </span>
          </div>
          {(pokemon.sprites.artwork ?? pokemon.sprites.front_default) && (
            // eslint-disable-next-line @next/next/no-img-element -- sprite da PokéAPI
            <img
              src={pokemon.sprites.artwork ?? pokemon.sprites.front_default ?? ""}
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
            {pokemon.types.map((t) => (
              <TypeBadge key={t.type.name} type={t.type.name} />
            ))}
          </div>
          <div className="mt-5 flex gap-8 text-center">
            <div>
              <p className="font-title text-lg tracking-wide">{(pokemon.height / 10).toFixed(1)} m</p>
              <p className="text-xs font-bold uppercase tracking-wider text-ink-dim">Altura</p>
            </div>
            <div>
              <p className="font-title text-lg tracking-wide">{(pokemon.weight / 10).toFixed(1)} kg</p>
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
              {pokemon.stats.map((s) => (
                <div
                  key={s.stat.name}
                  className="grid grid-cols-[110px_44px_1fr] items-center gap-3 text-sm"
                >
                  <span className="font-bold uppercase tracking-wide text-ink-dim">
                    {STAT_LABELS[s.stat.name] ?? s.stat.name}
                  </span>
                  <span className="font-title tracking-wider tabular-nums">{s.base_stat}</span>
                  <HpBar current={s.base_stat} max={STAT_MAX} tone="energy" />
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
                ({pokemon.moves.length} no total)
              </span>
            </h2>
            <div className="flex flex-wrap gap-2">
              {pokemon.moves.slice(0, 12).map((m) => (
                <span
                  key={m.move.name}
                  className="clip-btn border border-edge px-3 py-1 text-xs font-bold uppercase tracking-wide text-ink-dim"
                >
                  {m.move.name.replace(/-/g, " ")}
                </span>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
