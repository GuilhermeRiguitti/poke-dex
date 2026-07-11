import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchPokemon } from "@/lib/pokeapi";
import TypeBadge from "@/components/TypeBadge";
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
      <Link href="/" className="text-sm text-ink-dim hover:text-ink">
        ← Voltar para a PokéDex
      </Link>

      <div className="mt-4 grid gap-6 md:grid-cols-[320px_1fr]">
        {/* Retrato */}
        <div
          className="flex flex-col items-center rounded-2xl border border-edge bg-surface p-6"
          style={{ boxShadow: `inset 0 4px 60px -30px ${mainColor}80` }}
        >
          <span className="self-start text-sm font-bold text-ink-dim">
            #{String(pokemon.id).padStart(4, "0")}
          </span>
          {(pokemon.sprites.artwork ?? pokemon.sprites.front_default) && (
            // eslint-disable-next-line @next/next/no-img-element -- sprite da PokéAPI
            <img
              src={pokemon.sprites.artwork ?? pokemon.sprites.front_default ?? ""}
              alt={pokemon.name}
              className="h-52 w-52 object-contain"
            />
          )}
          <h1 className="mt-2 text-2xl font-extrabold capitalize">{pokemon.name}</h1>
          <div className="mt-2 flex gap-2">
            {pokemon.types.map((t) => (
              <TypeBadge key={t.type.name} type={t.type.name} />
            ))}
          </div>
          <div className="mt-4 flex gap-6 text-center text-sm">
            <div>
              <p className="font-bold">{(pokemon.height / 10).toFixed(1)} m</p>
              <p className="text-ink-dim">Altura</p>
            </div>
            <div>
              <p className="font-bold">{(pokemon.weight / 10).toFixed(1)} kg</p>
              <p className="text-ink-dim">Peso</p>
            </div>
          </div>
        </div>

        {/* Stats + moves */}
        <div className="flex flex-col gap-6">
          <section className="rounded-2xl border border-edge bg-surface p-6">
            <h2 className="mb-4 font-bold">Stats base</h2>
            <div className="flex flex-col gap-3">
              {pokemon.stats.map((s) => (
                <div key={s.stat.name} className="grid grid-cols-[110px_40px_1fr] items-center gap-3 text-sm">
                  <span className="text-ink-dim">{STAT_LABELS[s.stat.name] ?? s.stat.name}</span>
                  <span className="font-bold tabular-nums">{s.base_stat}</span>
                  <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, (s.base_stat / STAT_MAX) * 100)}%`,
                        backgroundColor: mainColor,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-edge bg-surface p-6">
            <h2 className="mb-4 font-bold">
              Alguns movimentos{" "}
              <span className="text-sm font-normal text-ink-dim">
                ({pokemon.moves.length} no total)
              </span>
            </h2>
            <div className="flex flex-wrap gap-2">
              {pokemon.moves.slice(0, 12).map((m) => (
                <span
                  key={m.move.name}
                  className="rounded-full border border-edge px-3 py-1 text-xs capitalize text-ink-dim"
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
