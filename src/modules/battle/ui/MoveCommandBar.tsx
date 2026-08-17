"use client";

import { useEffect } from "react";
import { typeColor } from "@/src/lib/typeColors";
import type { DuelCardView } from "./battleView";

// O console de comando dos golpes. As "cartas" são os POKÉMON (coleção), então
// aqui o golpe NÃO é uma carta — e também não é um card solto: os seis golpes
// formam UMA máquina só. Casco chanfrado, células divididas por nervura e um
// trilho de energia compartilhado no rodapé, com a MESMA gema que a célula usa
// pra mostrar o custo. É essa comparação ("tenho 3, isso custa 3") que decide a
// jogada, então as duas peças têm que ser o mesmo desenho.
//
// Sem barra de progresso pro poder: poder não tem máximo pra medir, uma barra
// ali seria decoração mentindo que existe teto. Poder é número, PP é contagem,
// e o único medidor é o trilho de energia — esse tem máximo real (energyMax).

const CLASS_META: Record<
  DuelCardView["damageClass"],
  { short: string; color: string; hint: string }
> = {
  physical: { short: "FÍS", color: "var(--color-flare)", hint: "Físico — o dano usa o Ataque" },
  special: { short: "ESP", color: "var(--color-energy)", hint: "Especial — o dano usa o Ataque Especial" },
  status: { short: "STA", color: "var(--color-ink-dim)", hint: "Status — sem dano direto; muda o campo/estado" },
};

/**
 * O selo de vantagem. `null` (carta de status, carta sem poder) e 1x não
 * desenham nada: só o que muda a decisão ganha tinta, senão o selo vira ruído
 * em seis células ao mesmo tempo.
 */
function advantageOf(mult: number | null) {
  if (mult == null || mult === 1) return null;
  if (mult > 1) return { top: "super", bottom: "eficaz", color: "var(--color-ok)", hint: `Dano ×${mult} contra o tipo do oponente` };
  if (mult > 0) return { top: "pouco", bottom: "eficaz", color: "var(--color-bad)", hint: `Dano ×${mult} contra o tipo do oponente` };
  return { top: "não", bottom: "afeta", color: "var(--color-bad)", hint: "O oponente é imune a este tipo" };
}

/**
 * Uma célula do console. Exportada à parte porque o design system mostra os
 * estados dela isolados — e porque um dia a versão mobile pode montar outro
 * casco em volta das mesmas células.
 */
export function MoveCell({
  card,
  disabled = false,
  casting = false,
  armed = false,
  shortcut,
  onPlay,
}: {
  card: DuelCardView;
  disabled?: boolean;
  casting?: boolean;
  /** selecionada, esperando confirmação — pulsa em flare */
  armed?: boolean;
  /** número do atalho de teclado (1–6). Sem ele a célula não mostra a tecla. */
  shortcut?: number;
  onPlay?: () => void;
}) {
  const cls = CLASS_META[card.damageClass];
  const noPp = card.currentPp <= 0;
  const name = card.name.replace(/-/g, " ");
  const adv = advantageOf(card.effectiveness);

  // O MOTIVO do bloqueio é escrito, não só o botão apagado: "sem PP" só passa
  // trocando de pokémon, "sem energia" passa sozinho no próximo round. Cinza
  // igual pros dois faz o jogador achar que o jogo travou.
  const custo =
    card.disabledReason === "energy"
      ? "sem energia"
      : card.disabledReason === "pp"
        ? "sem usos"
        : `custa ${card.energyCost}`;

  const nota =
    card.disabledReason === "pp"
      ? "só volta trocando de pokémon"
      : card.disabledReason === "energy"
        ? "volta 1 de energia por round"
        : card.accuracy != null && card.accuracy < 100
          ? `${card.effectLabel ? `${card.effectLabel} · ` : ""}${card.accuracy}% acerto`
          : (card.effectLabel ?? (card.damageClass === "status" ? "sem efeito" : ""));

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onPlay}
      data-armed={armed || undefined}
      style={{ ["--type-c" as string]: typeColor(card.type) }}
      className={`cmd-cell ${casting ? "cmd-cell--cast" : ""}`}
      aria-label={`${name} · ${card.type} · ${cls.short} · poder ${card.power ?? "sem dano"} · ${card.currentPp} de ${card.maxPp} usos · custa ${card.energyCost} de energia${adv ? ` · ${adv.top} ${adv.bottom}` : ""}`}
    >
      {/* 1. identificação */}
      <span className="relative flex items-center gap-1.5">
        {shortcut != null && (
          <span
            className="plate shrink-0 px-1.5 font-title text-[10px] tracking-wide text-bg"
            style={{ background: "var(--type-c)" }}
            aria-hidden
          >
            <span className="plate-inner">{shortcut}</span>
          </span>
        )}
        <span className="min-w-0 flex-1 truncate font-title text-xs uppercase tracking-wide text-ink">
          {name}
        </span>
        <span
          title={cls.hint}
          className="shrink-0 px-1 font-title text-[8px] tracking-widest text-bg"
          style={{ backgroundColor: cls.color }}
        >
          {cls.short}
        </span>
      </span>

      {/* 2. o número que decide: poder, com o emblema do tipo do lado */}
      <span className="relative mt-1.5 flex items-center gap-2">
        <span className="cmd-orb" title={card.type} aria-hidden>
          <span className="font-title text-[9px] uppercase tracking-wide text-black/85">
            {card.type.slice(0, 3)}
          </span>
        </span>
        <span className="flex flex-col leading-[0.82]">
          <span
            className="font-title text-[30px]"
            style={{ color: "var(--type-c)", textShadow: "0 0 14px color-mix(in srgb, var(--type-c) 55%, transparent)" }}
          >
            {card.power ?? "—"}
          </span>
          <span className="mt-0.5 text-[7px] font-bold uppercase tracking-[0.18em] text-ink-dim">
            {card.power != null ? "Poder" : "Sem dano"}
          </span>
        </span>
        {adv && (
          <span
            title={adv.hint}
            className="ml-auto shrink-0 px-1 py-px text-center font-title text-[8px] uppercase leading-[1.15] tracking-widest"
            style={{
              color: adv.color,
              border: `1px solid color-mix(in srgb, ${adv.color} 45%, transparent)`,
              background: `color-mix(in srgb, ${adv.color} 10%, transparent)`,
            }}
          >
            {adv.top}
            <br />
            {adv.bottom}
          </span>
        )}
      </span>

      {/* 3. usos + o que a carta faz além de bater */}
      <span className="relative mt-1.5 flex items-baseline gap-1">
        <span
          className={`shrink-0 whitespace-nowrap font-title text-[11px] tracking-wide tabular-nums ${noPp ? "text-bad" : "text-ink"}`}
          title="Usos restantes deste golpe"
        >
          {card.currentPp}/{card.maxPp}
        </span>
        <span className="shrink-0 text-[7px] font-bold uppercase tracking-[0.15em] text-ink-dim">usos</span>
        <span
          className={`min-w-0 flex-1 truncate text-right text-[9px] font-semibold ${
            card.disabledReason ? "text-bad" : card.effectLabel ? "text-energy" : "text-ink-dim/50"
          }`}
          title={nota || "Esta carta ainda não tem efeito no jogo"}
        >
          {nota}
        </span>
      </span>

      {/* 4. custo, na mesma gema do trilho lá embaixo */}
      <span className="relative mt-1.5 flex h-3 items-center gap-1" title={`Custa ${card.energyCost} de energia`}>
        {Array.from({ length: card.energyCost }, (_, i) => (
          <span key={i} className="cmd-pip" data-bad={card.disabledReason === "energy" || undefined} />
        ))}
        <span
          className={`ml-1 shrink-0 whitespace-nowrap text-[8px] font-bold uppercase tracking-wider ${
            card.disabledReason ? "text-bad" : "text-ink-dim"
          }`}
        >
          {custo}
        </span>
      </span>
    </button>
  );
}

export default function MoveCommandBar({
  cards,
  locked,
  casting,
  onPlay,
  energy,
  energyMax,
  armedSlot,
  shortcuts = true,
}: {
  cards: DuelCardView[];
  locked: boolean;
  casting: number | null;
  onPlay: (slot: number) => void;
  /** energia disponível agora — desenha o trilho do rodapé */
  energy?: number;
  energyMax?: number;
  /** slot selecionado esperando confirmação, quando a tela usar 2 passos */
  armedSlot?: number | null;
  /** atalhos 1–6; desligue no mobile, onde não há teclado */
  shortcuts?: boolean;
}) {
  // Teclado 1–6: é o console de um jogo, não um formulário. A tecla joga a
  // célula da posição, não o slot — o jogador conta o que vê na tela.
  useEffect(() => {
    if (!shortcuts) return;
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const i = Number(e.key) - 1;
      if (!Number.isInteger(i) || i < 0 || i >= cards.length) return;
      const c = cards[i];
      if (locked || c.disabled) return;
      e.preventDefault();
      onPlay(c.slot);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cards, locked, onPlay, shortcuts]);

  const temTrilho = energy != null && energyMax != null;

  return (
    <div className="cmd-console w-fit max-w-[min(58rem,96vw)]">
      <div className="cmd-head flex items-center gap-2 px-4 py-1">
        <span className="h-1.5 w-1.5 rotate-45 bg-energy shadow-[0_0_10px_var(--color-energy)]" aria-hidden />
        <span className="shrink-0 font-title text-[10px] uppercase tracking-[0.18em] text-energy">
          Escolha a jogada
        </span>
        <span className="cmd-dash hidden flex-1 sm:block" aria-hidden />
        <span className="hidden shrink-0 font-title text-[10px] uppercase tracking-[0.18em] text-ink-dim sm:block">
          Turno simultâneo
        </span>
      </div>

      <div className="cmd-grid flex items-stretch">
        {cards.map((c, i) => (
          <MoveCell
            key={c.slot}
            card={c}
            disabled={locked || c.disabled}
            casting={casting === c.slot}
            armed={armedSlot === c.slot}
            shortcut={shortcuts ? i + 1 : undefined}
            onPlay={() => onPlay(c.slot)}
          />
        ))}
      </div>

      {temTrilho && (
        <div className="cmd-rail flex items-center gap-2.5 px-4 pb-1.5 pt-1">
          <span className="shrink-0 font-title text-[10px] uppercase tracking-[0.18em] text-ink-dim">
            Energia
          </span>
          <span className="flex items-center gap-1.5" title={`${energy} de ${energyMax} de energia`}>
            {Array.from({ length: energyMax }, (_, i) => (
              <span key={i} className="cmd-pip cmd-pip--rail" data-empty={i >= energy || undefined} />
            ))}
          </span>
          <span className="shrink-0 font-title text-[11px] tracking-wider tabular-nums text-energy">
            {energy} / {energyMax}
          </span>
          <span className="cmd-dash--flow hidden flex-1 sm:block" aria-hidden />
          <span className="hidden shrink-0 text-[10px] font-bold uppercase tracking-wider text-ink-dim lg:block">
            +1 por rodada · trocar gasta o turno
          </span>
        </div>
      )}
    </div>
  );
}
