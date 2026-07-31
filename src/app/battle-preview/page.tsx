"use client";

// TEMP — verificação visual da arena 3D + barra de comando + relatório. Público
// (fora do grupo (game)). Dados fake. APAGAR depois do print.

import { useState } from "react";
import DuelArena from "@/src/modules/battle/ui/DuelArena";
import type { DuelTurnFx, DuelView } from "@/src/modules/battle/ui/battleView";

const art = (id: number) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;

const baseView: DuelView = {
  me: { name: "pikachu", level: 14, spriteUrl: art(25), types: ["electric"], currentHp: 38, maxHp: 60, hpPct: 63, fainted: false },
  opp: { name: "charizard", level: 17, spriteUrl: art(6), types: ["fire", "flying"], currentHp: 82, maxHp: 118, hpPct: 69, fainted: false },
  myParty: [
    { slot: 0, name: "pikachu", spriteUrl: art(25), hpPct: 63, fainted: false, isActive: true, canSwitchTo: false },
    { slot: 1, name: "gyarados", spriteUrl: art(130), hpPct: 100, fainted: false, isActive: false, canSwitchTo: true },
    { slot: 2, name: "gengar", spriteUrl: art(94), hpPct: 45, fainted: false, isActive: false, canSwitchTo: true },
  ],
  oppParty: [
    { slot: 0, name: "charizard", spriteUrl: art(6), hpPct: 69, fainted: false, isActive: true, canSwitchTo: false },
    { slot: 1, name: "?", spriteUrl: null, hpPct: 100, fainted: false, isActive: false, canSwitchTo: false },
    { slot: 2, name: "?", spriteUrl: null, hpPct: 0, fainted: true, isActive: false, canSwitchTo: false },
  ],
  cards: [
    { slot: 0, name: "thunderbolt", type: "electric", power: 90, damageClass: "special", accuracy: 100, currentPp: 15, maxPp: 15, disabled: false },
    { slot: 1, name: "quick-attack", type: "normal", power: 40, damageClass: "physical", accuracy: 100, currentPp: 30, maxPp: 30, disabled: false },
    { slot: 2, name: "iron-tail", type: "steel", power: 100, damageClass: "physical", accuracy: 75, currentPp: 0, maxPp: 15, disabled: false },
    { slot: 3, name: "thunder-wave", type: "electric", power: null, damageClass: "status", accuracy: 90, currentPp: 20, maxPp: 20, disabled: false },
  ],
  switchTargets: [1, 2],
  mode: "choose",
  canPlay: true,
  canSwitch: true,
  waitingOpponent: false,
  opponentReady: false,
  round: 4,
  status: "IN_PROGRESS",
  isOver: false,
  iWon: false,
  isDraw: false,
  logLines: [
    { key: "1", text: "— Rodada 3 —" },
    { key: "2", text: "Você usou quick-attack (22 de dano)." },
    { key: "3", text: "Oponente usou flamethrower (31 de dano, super eficaz)." },
  ],
  fx: null,
};

export default function BattlePreviewPage() {
  const [view, setView] = useState<DuelView>(baseView);

  function simulate(fx: Omit<DuelTurnFx, "turnNumber">) {
    const turnNumber = (view.fx?.turnNumber ?? 0) + 1;
    setView((v) => ({
      ...v,
      fx: { ...fx, turnNumber },
      logLines: [...v.logLines, { key: `sim-${turnNumber}`, text: describe(fx) }],
    }));
  }

  function describe(fx: Omit<DuelTurnFx, "turnNumber">): string {
    if (fx.kind === "hesitate") return `${fx.actor === "me" ? "Você" : "Oponente"} hesitou (turno perdido).`;
    const who = fx.actor === "me" ? "Você" : "Oponente";
    if (fx.missed) return `${who} usou ${fx.cardName} — errou!`;
    const eff = fx.effectiveness > 1 ? ", super eficaz" : fx.effectiveness < 1 ? ", pouco eficaz" : "";
    const crit = fx.isCrit ? ", crítico" : "";
    const ko = fx.fainted ? " Nocaute!" : "";
    return `${who} usou ${fx.cardName} (${fx.damage} de dano${eff}${crit}).${ko}`;
  }

  return (
    <main className="mx-auto flex h-screen max-w-3xl flex-col p-4">
      <div className="mb-2 flex flex-wrap gap-2">
        <button
          className="clip-btn bg-flare px-3 py-1.5 font-title text-xs uppercase text-white"
          onClick={() => simulate({ actor: "me", kind: "attack", cardName: "thunderbolt", target: "opp", damage: 34, effectiveness: 2, isCrit: false, missed: false, fainted: false })}
        >
          Eu ataco (super eficaz)
        </button>
        <button
          className="clip-btn bg-enemy px-3 py-1.5 font-title text-xs uppercase text-white"
          onClick={() => simulate({ actor: "opp", kind: "attack", cardName: "flamethrower", target: "me", damage: 41, effectiveness: 1, isCrit: true, missed: false, fainted: false })}
        >
          Oponente ataca (crítico)
        </button>
        <button
          className="clip-btn bg-panel-2 px-3 py-1.5 font-title text-xs uppercase text-ink-dim"
          onClick={() => simulate({ actor: "me", kind: "attack", cardName: "iron-tail", target: "opp", damage: 0, effectiveness: 1, isCrit: false, missed: true, fainted: false })}
        >
          Eu erro
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-edge">
        <DuelArena view={view} submitting={false} onPlayCard={() => {}} onSwitch={() => {}} />
      </div>
    </main>
  );
}
