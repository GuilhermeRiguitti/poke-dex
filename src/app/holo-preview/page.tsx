// TEMP — página de verificação visual do HoloCard (coleção + pacote). Fora do
// grupo (game), então é pública (sem login). APAGAR depois do print.

import PackRevealCard from "@/src/modules/packs/ui/PackRevealCard";
import type { RarityTier } from "@/src/modules/packs/domain/rarity";
import type { PackCardDTO } from "@/src/modules/packs/ui/types";
import PokemonCard from "@/src/modules/pokedex/ui/PokemonCard";

const art = (id: number) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;

// variedade de tiers pra ver o holo metálico escalar pela fortitude
const collection: {
  id: number;
  dex: string;
  name: string;
  types: string[];
  level: number;
  rarity: RarityTier;
  inDeck: boolean;
}[] = [
  { id: 25, dex: "#0025", name: "pikachu", types: ["electric"], level: 12, rarity: "common", inDeck: true },
  { id: 67, dex: "#0067", name: "machoke", types: ["fighting"], level: 28, rarity: "uncommon", inDeck: false },
  { id: 6, dex: "#0006", name: "charizard", types: ["fire", "flying"], level: 36, rarity: "rare", inDeck: false },
  { id: 130, dex: "#0130", name: "gyarados", types: ["water", "flying"], level: 30, rarity: "rare", inDeck: false },
  { id: 150, dex: "#0150", name: "mewtwo", types: ["psychic"], level: 70, rarity: "legendary", inDeck: false },
];

const pack: PackCardDTO[] = [
  {
    pokemonId: 150,
    card: { id: 150, name: "mewtwo", artworkUrl: art(150), iconUrl: null, types: ["psychic"] },
    bst: 680,
    rarity: "legendary",
    isNew: true,
  },
  {
    pokemonId: 143,
    card: { id: 143, name: "snorlax", artworkUrl: art(143), iconUrl: null, types: ["normal"] },
    bst: 540,
    rarity: "rare",
    isNew: true,
  },
  {
    pokemonId: 16,
    card: { id: 16, name: "pidgey", artworkUrl: art(16), iconUrl: null, types: ["normal", "flying"] },
    bst: 251,
    rarity: "common",
    isNew: false,
  },
];

export default function HoloPreviewPage() {
  return (
    <main className="mx-auto max-w-6xl p-8">
      <h1 className="mb-6 font-title text-2xl uppercase tracking-wider text-ink">
        HoloCard — preview (temp)
      </h1>

      <h2 className="mb-3 font-title text-sm uppercase tracking-widest text-ink-dim">
        Coleção (montar deck) — holo escala do comum ao lendário
      </h2>
      <div className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {collection.map((c, i) => (
          <PokemonCard
            key={c.id}
            pokemonId={c.id}
            dexNumber={c.dex}
            name={c.name}
            artworkUrl={art(c.id)}
            types={c.types}
            accentType={c.types[0]}
            rarity={c.rarity}
            index={i}
            highlighted={c.inDeck}
            level={c.level}
          >
            <button className="clip-btn w-full bg-panel-2 py-1.5 font-title text-xs uppercase tracking-wide text-ink-dim">
              {c.inDeck ? "No deck ✓" : "+ Deck"}
            </button>
          </PokemonCard>
        ))}
      </div>

      <h2 className="mb-3 font-title text-sm uppercase tracking-widest text-ink-dim">
        Abertura de pacote (legendary = metálico + aura)
      </h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {pack.map((card, i) => (
          <PackRevealCard key={card.pokemonId} card={card} index={i} />
        ))}
      </div>
    </main>
  );
}
