"use client";

import { useMemo } from "react";
import BattleErrorToast from "./BattleErrorToast";
import BattleResultOverlay from "./BattleResultOverlay";
import DuelTable from "./DuelTable";
import { selectDuelView } from "./battleView";
import type { BattleDTO } from "./types";
import { useBattleRoom } from "./useBattleRoom";

// A sala é só a costura: hook (servidor) + view-model (puro) + mesa (HTML).
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
  const { battle, error, submitting, playCard, playSwitch } = useBattleRoom(battleId, initialBattle);

  const view = useMemo(() => selectDuelView(battle, myUserId), [battle, myUserId]);

  // Só acontece se a partida vier sem o participante/ativo esperado — a page já
  // garantiu que sou participante, então isso é defesa, não fluxo normal.
  if (!view) return null;

  return (
    <div className="relative h-full">
      <DuelTable view={view} submitting={submitting} onPlayCard={playCard} onSwitch={playSwitch} />

      {error && <BattleErrorToast message={error} />}

      {view.isOver && (
        <BattleResultOverlay status={battle.status} iWon={view.iWon} isDraw={view.isDraw} />
      )}
    </div>
  );
}
