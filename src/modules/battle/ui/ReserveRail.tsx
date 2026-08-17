import PokeCard from "@/src/modules/pokemon/ui/PokeCard";
import { reserveHiddenPx, reserveHpTopPx, reserveSliverPx } from "@/src/modules/pokemon/ui/pokeCardView";
import type { PartyMemberView } from "./battleView";

// O BANCO DE RESERVAS: as cartas do meu time, SEMPRE na tela, flutuando no
// palco — sem painel em volta. A moldura era mais uma "ilha" de HUD tapando o
// cenário, e a carta já tem moldura própria: uma dentro da outra só empilhava
// borda.
//
// As cartas são a versão COM os 6 atributos, EMPILHADAS na HORIZONTAL: cada uma
// cobre a anterior e sobra a coluna da esquerda dela. É a pilha que devolve a
// largura — cinco cartas soltas não caberiam — e é essa largura devolvida que
// paga uma carta grande o bastante pra os atributos serem legíveis quando ela
// abre.
//
// Abrir é o HOVER (ou o foco do teclado): a carta sobe e cresce. Não é uma
// segunda carta desenhada ao lado — é a mesma, ampliada, então o que se lê
// aberto é exatamente o que estava lá fechado.
//
// O medidor de vida fica na fatia à mostra, logo abaixo do cabeçalho. HP de
// reserva é o que decide pra quem trocar, então não pode ser a parte que a
// pilha esconde.
//
// Sem estado de React de propósito: abrir/fechar é `:hover`/`:focus-within` do
// CSS. Este componente re-renderiza a cada resposta do polling (2s), e estado de
// ponteiro aqui viraria re-render em cima de re-render.

export default function ReserveRail({
  party,
  disabled,
  canSwitch,
  forceOpen,
  onSwitch,
}: {
  party: PartyMemberView[];
  disabled: boolean;
  /** posso trocar agora? decide o aviso acima da pilha */
  canSwitch: boolean;
  /** troca forçada: a pilha vira A jogada e se anuncia */
  forceOpen?: boolean;
  onSwitch: (slot: number) => void;
}) {
  const reserves = party.filter((m) => !m.isActive);
  if (reserves.length === 0) return null;

  const alive = reserves.filter((m) => !m.fainted).length;

  return (
    <div
      className="rrail"
      data-forced={forceOpen || undefined}
      style={
        {
          "--rr-hidden": `${reserveHiddenPx()}px`,
          "--rr-sliver": `${reserveSliverPx()}px`,
          "--rr-hp-top": `${reserveHpTopPx()}px`,
        } as React.CSSProperties
      }
    >
      {/* O aviso é texto solto com sombra, não uma placa: a pilha flutua, e uma
          barra de título em cima dela devolveria a ilha que saiu. */}
      <p className="rrail-hint">
        <span className="text-ink-dim">
          Reservas <span className="font-title text-ink">{alive}</span>
        </span>
        <span className={forceOpen ? "animate-pulse text-flare" : canSwitch ? "text-flare" : "text-ink-dim"}>
          {forceOpen ? "Escolha o substituto" : canSwitch ? "Trocar gasta o turno" : "Sem troca agora"}
        </span>
      </p>

      <ul className="rrail-list">
        {reserves.map((m, i) => {
          const clickable = m.canSwitchTo && !disabled;
          const name = m.name.replace(/-/g, " ");
          const tone = m.hpPct > 50 ? "var(--color-ok)" : m.hpPct > 20 ? "var(--color-warn)" : "var(--color-bad)";

          return (
            <li key={m.slot} className="rrail-item">
              <button
                type="button"
                disabled={!clickable}
                data-fainted={m.fainted || undefined}
                onClick={() => onSwitch(m.slot)}
                title={m.fainted ? `${name} está nocauteado` : `Trocar para ${name}`}
                aria-label={
                  m.fainted
                    ? `${name}, nocauteado`
                    : `Trocar para ${name}, nível ${m.level}, ${m.currentHp} de ${m.maxHp} de HP`
                }
                className="rrail-slot"
              >
                <PokeCard
                  dexNumber={m.dexNumber}
                  name={name}
                  artworkUrl={m.spriteUrl}
                  types={m.types}
                  rarity={m.rarity}
                  size="duel"
                  index={i}
                  // baseStats só vem preenchido pro MEU time (ver toBattleDTO).
                  // Sem ele a carta some com as barras e a arte cresce no lugar
                  // delas — não fica buraco.
                  details={{ level: m.level, baseStats: m.baseStats ?? undefined }}
                />
                <span className="rrail-hp" title={`${m.currentHp} / ${m.maxHp} de HP`} aria-hidden>
                  <span style={{ width: `${m.hpPct}%`, background: tone }} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
