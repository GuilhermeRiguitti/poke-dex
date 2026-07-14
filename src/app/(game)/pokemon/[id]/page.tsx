import Link from "next/link";
import { notFound } from "next/navigation";
import { getPokemonDetail } from "@/src/modules/pokedex";
import PokemonMoves from "@/src/modules/pokedex/ui/PokemonMoves";
import PokemonPortrait from "@/src/modules/pokedex/ui/PokemonPortrait";
import PokemonStats from "@/src/modules/pokedex/ui/PokemonStats";
import { detailView } from "@/src/modules/pokedex/ui/pokedexView";

// Page é servidor, e aqui a árvore INTEIRA é servidor: a tela de detalhe não
// tem estado nem evento — é retrato, stats e chips de move. Nenhum componente
// desta rota leva "use client"; o único JS que ela manda pro browser é o do
// Link do Next.
//
// getPokemonDetail só LÊ (fetch read-through no cache do Next, sem escrita), e
// por isso pode ser chamada no render — ver CLAUDE.md, regra 2.
export default async function PokemonDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const pokemon = await getPokemonDetail(id);
  if (!pokemon) notFound();

  const view = detailView(pokemon);

  return (
    <div className="pt-8">
      <Link
        href="/"
        className="text-sm font-bold uppercase tracking-wide text-ink-dim hover:text-energy"
      >
        ← PokéDex
      </Link>

      <div className="mt-4 grid gap-6 md:grid-cols-[320px_1fr]">
        <PokemonPortrait
          dexNumber={view.dexNumber}
          name={view.name}
          artworkUrl={view.artworkUrl}
          types={view.types}
          accentType={view.accentType}
          heightMeters={view.heightMeters}
          weightKg={view.weightKg}
        />

        <div className="flex flex-col gap-6">
          <PokemonStats statBars={view.statBars} />
          <PokemonMoves moveNames={view.moveNames} totalMoves={view.totalMoves} />
        </div>
      </div>
    </div>
  );
}
