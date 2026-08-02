import ReserveHand from "./ReserveHand";
import type { PartyMemberView } from "./battleView";

// A GAVETA de reservas, no canto de baixo à direita. Fechada, é só uma ficha com
// a contagem; passar o mouse (ou dar foco pelo teclado) abre o leque de cartas.
//
// Por que gaveta e não leque sempre aberto: o leque ocupava o rodapé inteiro e
// disputava espaço com a barra de golpes — que é a decisão do round. A troca é a
// exceção, então ela fica guardada, mas a UM movimento de distância.
//
// Abrir/fechar é CSS puro (:hover / :focus-within) — sem estado, sem re-render
// no meio do polling. `forceOpen` é o único caso em que o React manda: na troca
// forçada a gaveta não pode depender do mouse, ela É a jogada.

export default function ReserveDrawer({
  party,
  disabled,
  canSwitch,
  forceOpen,
  onSwitch,
}: {
  party: PartyMemberView[];
  disabled: boolean;
  /** posso trocar agora? decide o aviso do cabeçalho */
  canSwitch: boolean;
  /** troca forçada: a gaveta abre e fica aberta */
  forceOpen?: boolean;
  onSwitch: (slot: number) => void;
}) {
  const reserves = party.filter((m) => !m.isActive);
  if (reserves.length === 0) return null;
  const alive = reserves.filter((m) => !m.fainted).length;

  return (
    <div className="reserve-dock" data-open={forceOpen || undefined}>
      <div className="reserve-panel hud-panel" data-side="me">
        <header className="flex items-center justify-between gap-3 px-2.5 py-1.5">
          <span className="font-title text-[10px] uppercase tracking-widest text-ink-dim">
            Reservas{!forceOpen && " · passe o mouse para abrir"}
          </span>
          <span className="font-title text-[9px] uppercase tracking-widest text-flare">
            {forceOpen ? "Escolha o substituto" : canSwitch ? "Trocar gasta o turno" : "Sem troca agora"}
          </span>
        </header>
        <div className="px-4 pb-5">
          <ReserveHand party={party} disabled={disabled} onSwitch={onSwitch} />
        </div>
      </div>

      <button type="button" className="reserve-chip" aria-expanded={forceOpen ? true : undefined}>
        <span className="reserve-chip-icon" aria-hidden />
        <span className="font-title text-[11px] uppercase tracking-widest">Reservas</span>
        <span className="reserve-chip-count">{alive}</span>
      </button>
    </div>
  );
}
