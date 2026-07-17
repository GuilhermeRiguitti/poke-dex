import Link from "next/link";
import TypeBadge from "@/src/components/TypeBadge";
import { typeColor } from "@/src/lib/typeColors";

// A moldura do card, uma vez só. Ela estava copiada entre a listagem da dex e
// a coleção: mesma --type-c, mesmo animate-rise escalonado, mesmo #0000, mesmo
// sprite com o mesmo fallback, mesma coluna de TypeBadge. Só o RODAPÉ mudava —
// "Capturar" de um lado, "+ Deck / Soltar" do outro. Então o rodapé é
// `children`, e é a única coisa que os dois lados escrevem.
//
// É Server Component. O rodapé que o chamador passa pode ser "use client" (e é,
// na coleção) — a fronteira do cliente fica NELE, não no card.

export default function PokemonCard({
  pokemonId,
  dexNumber,
  name,
  artworkUrl,
  types,
  accentType,
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
    <div
      data-highlighted={highlighted || undefined}
      className="card-frame clip-card animate-rise flex flex-col p-3 data-highlighted:border-flare/60"
      style={
        {
          "--type-c": typeColor(accentType),
          animationDelay: `${index * 25}ms`,
        } as React.CSSProperties
      }
    >
      <div className="flex items-start justify-between">
        <span className="font-title text-xs tracking-wider text-ink-dim">{dexNumber}</span>
        <div className="flex flex-col items-end gap-1">
          {types.map((type) => (
            <TypeBadge key={type} type={type} small />
          ))}
        </div>
      </div>

      <Link
        href={`/pokemon/${pokemonId}`}
        className="flex flex-1 flex-col items-center justify-center py-1"
      >
        {artworkUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- sprites vêm da PokéAPI (host externo dinâmico)
          <img
            src={artworkUrl}
            alt={name}
            loading="lazy"
            className="h-24 w-24 object-contain drop-shadow-[0_6px_8px_rgba(0,0,0,.45)]"
          />
        )}
        <span className="mt-1 font-title uppercase tracking-wide">{name}</span>
        {level != null && (
          <span className="lv-badge mt-1">
            <span>Lv {level}</span>
          </span>
        )}
      </Link>

      {children && <div className="mt-2">{children}</div>}
    </div>
  );
}
