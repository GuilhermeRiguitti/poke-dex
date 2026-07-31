import Link from "next/link";
import HoloCard from "@/src/components/HoloCard";
import TypeBadge from "@/src/components/TypeBadge";
import { typeColor } from "@/src/lib/typeColors";
import type { RarityTier } from "@/src/modules/packs/domain/rarity";
import { holoIntensity, isTopRarity, rarityColor, rarityLabel } from "@/src/modules/packs/ui/packView";

// A moldura da carta, estilo TCG: janela de arte no topo, infos no rodapé, borda
// tingida pela RARIDADE (a mesma fortitude que o pacote usa). É Server Component:
// renderiza o HoloCard (esse sim "use client", o envelope 3D metálico) passando a
// face como children server-rendered — a fronteira do cliente é o HoloCard e o
// rodapé, nunca este arquivo. O rodapé (`children`) é a única parte que difere
// entre a listagem da dex e a coleção.

export default function PokemonCard({
  pokemonId,
  dexNumber,
  name,
  artworkUrl,
  types,
  accentType,
  rarity,
  index,
  highlighted,
  level,
  children,
}: {
  pokemonId: number;
  dexNumber: string;
  name: string;
  artworkUrl: string | null;
  types: string[];
  accentType: string;
  /** raridade pela fortitude — pinta a borda e escala o holo */
  rarity: RarityTier;
  /** posição no grid — escalona o animate-rise */
  index: number;
  /** moldura destacada (a coleção usa pra marcar quem está no deck) */
  highlighted?: boolean;
  /** nível do UserPokemon (só a coleção passa; a dex não) */
  level?: number;
  /** o rodapé: os botões. É a única parte que difere entre as telas. */
  children?: React.ReactNode;
}) {
  return (
    <HoloCard intensity={holoIntensity(rarity)}>
      <div
        data-highlighted={highlighted || undefined}
        data-prismatic={isTopRarity(rarity) || undefined}
        className="tcg-card clip-card animate-rise data-highlighted:border-flare/70"
        style={
          {
            "--type-c": typeColor(accentType),
            "--rarity-c": rarityColor(rarity),
            animationDelay: `${index * 25}ms`,
          } as React.CSSProperties
        }
      >
        <div className="tcg-header">
          <span className="tcg-name">{name}</span>
          {level != null ? (
            <span className="lv-badge">
              <span>Lv {level}</span>
            </span>
          ) : (
            <span className="tcg-bst">{dexNumber}</span>
          )}
        </div>

        <Link href={`/pokemon/${pokemonId}`} className="tcg-art clip-card">
          {artworkUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- sprites vêm da PokéAPI (host externo dinâmico)
            <img src={artworkUrl} alt={name} loading="lazy" />
          )}
        </Link>

        <div className="tcg-footer">
          <div className="tcg-row">
            <div className="flex gap-1">
              {types.map((type) => (
                <TypeBadge key={type} type={type} small />
              ))}
            </div>
            <span className="tcg-rarity">{rarityLabel(rarity)}</span>
          </div>
          {children}
        </div>
      </div>
    </HoloCard>
  );
}
