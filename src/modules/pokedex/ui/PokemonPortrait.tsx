import TypeBadge from "@/src/components/TypeBadge";
import { typeColor } from "@/src/lib/typeColors";

// O retrato da página de detalhe: sprite grande, placa do nome, tipos e ficha
// (altura/peso). Server Component — é só desenho, como o PokemonCard.
//
// Recebe a VIEW já pronta (m e kg, "#0025"), não o DTO: a conversão de unidade
// é regra de apresentação e mora em pokedexView (testada). Aqui é costura.

export default function PokemonPortrait({
  dexNumber,
  name,
  artworkUrl,
  types,
  accentType,
  heightMeters,
  weightKg,
}: {
  dexNumber: string;
  name: string;
  artworkUrl: string | null;
  types: string[];
  accentType: string;
  heightMeters: string;
  weightKg: string;
}) {
  const mainColor = typeColor(accentType);

  return (
    <div
      className="card-frame clip-card animate-rise flex flex-col items-center p-6"
      style={{ "--type-c": mainColor } as React.CSSProperties}
    >
      <div className="flex w-full items-center justify-between">
        <span className="font-title text-sm tracking-wider text-ink-dim">{dexNumber}</span>
      </div>

      {artworkUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- sprite da PokéAPI
        <img
          src={artworkUrl}
          alt={name}
          className="h-52 w-52 object-contain drop-shadow-[0_10px_14px_rgba(0,0,0,.5)]"
        />
      )}

      <h1 className="plate mt-3 px-4 py-1" style={{ backgroundColor: mainColor }}>
        <span className="plate-inner font-title text-2xl uppercase tracking-wide text-white [text-shadow:0_1px_3px_rgba(0,0,0,.5)]">
          {name}
        </span>
      </h1>

      <div className="mt-3 flex gap-2">
        {types.map((type) => (
          <TypeBadge key={type} type={type} />
        ))}
      </div>

      <dl className="mt-5 flex gap-8 text-center">
        <div>
          <dd className="font-title text-lg tracking-wide">{heightMeters} m</dd>
          <dt className="text-xs font-bold uppercase tracking-wider text-ink-dim">Altura</dt>
        </div>
        <div>
          <dd className="font-title text-lg tracking-wide">{weightKg} kg</dd>
          <dt className="text-xs font-bold uppercase tracking-wider text-ink-dim">Peso</dt>
        </div>
      </dl>
    </div>
  );
}
