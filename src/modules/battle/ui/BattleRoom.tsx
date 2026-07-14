"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";

import BattleErrorToast from "./BattleErrorToast";
import BattleResultOverlay from "./BattleResultOverlay";
import { selectBattleView } from "./battleView";
import type { BattleDTO } from "./types";
import { useBattleRoom } from "./useBattleRoom";

// Konva só existe no browser — nunca renderizar no servidor.
const BattleTable = dynamic(() => import("@/src/components/battle/BattleTable"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center">
      <p className="font-title uppercase tracking-wider text-ink-dim">Montando a mesa...</p>
    </div>
  ),
});

// A sala é só a costura: hook (servidor) + view-model (puro) + mesa (canvas).
// Nenhuma regra de apresentação mora aqui — ela está em battleView.ts.
export default function BattleRoom({
  battleId,
  myUserId,
  initialBattle,
}: {
  battleId: string;
  myUserId: string;
  initialBattle: BattleDTO;
}) {
  const { battle, error, waiting, submitting, submitAction } = useBattleRoom(battleId, initialBattle);

  const view = useMemo(() => selectBattleView(battle, myUserId), [battle, myUserId]);

  // Só acontece se a partida vier sem o participante/ativo esperado — a page
  // já garantiu que sou participante, então isso é defesa, não fluxo normal.
  if (!view) return null;

  const locked = submitting || waiting || view.isOver;

  return (
    <div className="relative h-full">
      <BattleTable
        myActive={view.myActive}
        oppActive={view.oppActive}
        bench={view.bench}
        moves={view.moves}
        locked={locked}
        needsSwitch={view.needsSwitch}
        waiting={waiting}
        turnNumber={battle.currentTurn}
        score={view.score}
        logLines={view.logLines}
        lastTurnEvents={view.lastTurnEvents}
        lastTurnNumber={view.lastTurnNumber}
        onAttack={(moveSlot) => submitAction(battle.currentTurn, { actionType: "MOVE", moveSlot })}
        onSwitch={(slot) => submitAction(battle.currentTurn, { actionType: "SWITCH", switchToSlot: slot })}
      />

      {error && <BattleErrorToast message={error} />}

      {view.isOver && <BattleResultOverlay status={battle.status} iWon={view.iWon} />}
    </div>
  );
}
