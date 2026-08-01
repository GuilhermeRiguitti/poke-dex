import PokeCard from "@/src/modules/pokedex/ui/PokeCard";
import type { PartyMemberView } from "./battleView";

// O leque de reservas: as cartas mini abertas em leque no rodapé da arena.
//
// Mostra SÓ os reservas — o pokémon ativo está no palco 3D, não na mão. Clicar
// numa carta é a troca (o mesmo `onSwitch(slot)` que a barra antiga disparava).
//
// A posição de cada carta é só CSS: `--rot` inclina em leque a partir do centro
// e `--lift` empurra as das pontas pra baixo, formando o arco. O hover endireita
// e levanta a carta. Em prefers-reduced-motion o globals.css desmonta o leque
// numa fileira reta.
//
// Não desenha stat: a carta `mini` não tem barras, e o DTO do duelo carrega os
// dois lados — stat aqui entregaria os números do oponente (ver toBattleDTO).

/** graus entre uma carta e a vizinha */
const SPREAD_DEG = 7;
/** quanto a carta desce por passo de distância do centro (arco do leque) */
const ARC_PX = 3;

export default function ReserveHand({
  party,
  disabled,
  onSwitch,
}: {
  /** o time inteiro; o ativo é filtrado aqui dentro */
  party: PartyMemberView[];
  /** true = já joguei o round / partida acabada: o leque não responde */
  disabled: boolean;
  onSwitch: (slot: number) => void;
}) {
  const reserves = party.filter((m) => !m.isActive);
  if (reserves.length === 0) return null;

  const center = (reserves.length - 1) / 2;

  return (
    <div className="rhand">
      {reserves.map((m, i) => {
        const offset = i - center;
        const clickable = m.canSwitchTo && !disabled;
        const name = m.name.replace(/-/g, " ");
        const tone = m.hpPct > 50 ? "var(--color-ok)" : m.hpPct > 20 ? "var(--color-warn)" : "var(--color-bad)";

        return (
          <button
            key={m.slot}
            type="button"
            disabled={!clickable}
            data-fainted={m.fainted || undefined}
            onClick={() => onSwitch(m.slot)}
            title={m.fainted ? `${name} está nocauteado` : `Trocar para ${name}`}
            aria-label={m.fainted ? `${name}, nocauteado` : `Trocar para ${name}`}
            className="rhand-slot"
            style={
              {
                "--rot": `${offset * SPREAD_DEG}deg`,
                "--lift": `${offset * offset * ARC_PX}px`,
                zIndex: i,
              } as React.CSSProperties
            }
          >
            <PokeCard
              dexNumber={m.dexNumber}
              name={name}
              artworkUrl={m.spriteUrl}
              types={m.types}
              rarity={m.rarity}
              size="mini"
              index={i}
              details={{ level: m.level }}
            />
            <span className="rhand-hp" aria-hidden>
              <span style={{ width: `${m.hpPct}%`, background: tone }} />
            </span>
          </button>
        );
      })}
    </div>
  );
}
