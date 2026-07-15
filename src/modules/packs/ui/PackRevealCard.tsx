import TypeBadge from "@/src/components/TypeBadge";
import { dexNumber } from "@/src/modules/pokedex/ui/pokedexView";
import { isTopRarity, rarityColor, rarityLabel } from "./packView";
import type { PackCardDTO } from "./types";

// Uma carta revelada do pacote. Presentational — sem estado, sem evento. A
// moldura usa a cor da RARIDADE (não do tipo), e o lendário ganha aura.
//
// Reusa dexNumber do pokedex/ui (pura). NÃO reusa PokemonCard porque a
// semântica é outra: aqui a borda é raridade e há badge de novo/repetida.

export default function PackRevealCard({ card, index }: { card: PackCardDTO; index: number }) {
  const color = rarityColor(card.rarity);
  const top = isTopRarity(card.rarity);
  const name = card.card?.name ?? dexNumber(card.pokemonId);
  const art = card.card?.artworkUrl ?? null;

  return (
    <div
      className="card-frame clip-card animate-pack-pop flex flex-col p-3"
      style={
        {
          "--type-c": color,
          animationDelay: `${index * 90}ms`,
          boxShadow: top ? `0 0 22px -2px ${color}` : undefined,
        } as React.CSSProperties
      }
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-title text-xs tracking-wider text-ink-dim">
          {dexNumber(card.pokemonId)}
        </span>
        {card.isNew ? (
          <span className="clip-btn bg-flare px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
            Novo
          </span>
        ) : (
          <span className="clip-btn bg-panel-2 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-dim">
            Repetida
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col items-center justify-center py-1">
        {art ? (
          // eslint-disable-next-line @next/next/no-img-element -- sprites vêm da PokéAPI (host externo dinâmico)
          <img
            src={art}
            alt={name}
            loading="lazy"
            className="h-24 w-24 object-contain drop-shadow-[0_6px_8px_rgba(0,0,0,.45)]"
          />
        ) : (
          <div className="flex h-24 w-24 items-center justify-center text-ink-dim">?</div>
        )}
        <span className="mt-1 font-title uppercase tracking-wide">{name}</span>
      </div>

      <div className="mt-2 flex items-center justify-between">
        <span
          className="font-title text-[11px] uppercase tracking-wider"
          style={{ color }}
        >
          {rarityLabel(card.rarity)}
        </span>
        <span className="font-title text-[11px] tracking-wider text-ink-dim">
          BST {card.bst}
        </span>
      </div>

      {(card.card?.types.length ?? 0) > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {card.card!.types.map((type) => (
            <TypeBadge key={type} type={type} small />
          ))}
        </div>
      )}
    </div>
  );
}
