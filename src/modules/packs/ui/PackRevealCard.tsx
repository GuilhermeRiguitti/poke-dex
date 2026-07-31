import HoloCard from "@/src/components/HoloCard";
import TypeBadge from "@/src/components/TypeBadge";
import { typeColor } from "@/src/lib/typeColors";
import { dexNumber } from "@/src/modules/pokedex/ui/pokedexView";
import { holoIntensity, isTopRarity, rarityColor, rarityLabel } from "./packView";
import type { PackCardDTO } from "./types";

// Uma carta revelada do pacote, na moldura estilo TCG (janela de arte no topo,
// infos no rodapé). A borda usa a cor da RARIDADE e o holo escala com a mesma
// fortitude (holoIntensity) — lendário fica metálico e com aura.
//
// Reusa dexNumber do pokedex/ui (pura). NÃO reusa PokemonCard porque a
// semântica é outra: aqui manda a raridade e há badge de novo/repetida.
// O HoloCard ("use client") é o envelope 3D; a page/PackOpener já é cliente.

export default function PackRevealCard({ card, index }: { card: PackCardDTO; index: number }) {
  const color = rarityColor(card.rarity);
  const top = isTopRarity(card.rarity);
  const name = card.card?.name ?? dexNumber(card.pokemonId);
  const art = card.card?.artworkUrl ?? null;
  const accentType = card.card?.types[0] ?? "normal";

  return (
    <HoloCard intensity={holoIntensity(card.rarity)}>
      <div
        data-prismatic={top || undefined}
        className="tcg-card clip-card animate-pack-pop"
        style={
          {
            "--type-c": typeColor(accentType),
            "--rarity-c": color,
            animationDelay: `${index * 90}ms`,
          } as React.CSSProperties
        }
      >
        <div className="tcg-header">
          <span className="tcg-name">{name}</span>
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

        <div className="tcg-art clip-card">
          {art ? (
            // eslint-disable-next-line @next/next/no-img-element -- sprites vêm da PokéAPI (host externo dinâmico)
            <img src={art} alt={name} loading="lazy" />
          ) : (
            <span className="text-ink-dim">?</span>
          )}
        </div>

        <div className="tcg-footer">
          <div className="tcg-row">
            {card.card && card.card.types.length > 0 ? (
              <div className="flex gap-1">
                {card.card.types.map((type) => (
                  <TypeBadge key={type} type={type} small />
                ))}
              </div>
            ) : (
              <span />
            )}
            <span className="tcg-rarity">{rarityLabel(card.rarity)}</span>
          </div>
          <div className="tcg-row">
            <span className="tcg-bst">{dexNumber(card.pokemonId)}</span>
            <span className="tcg-bst">BST {card.bst}</span>
          </div>
        </div>
      </div>
    </HoloCard>
  );
}
