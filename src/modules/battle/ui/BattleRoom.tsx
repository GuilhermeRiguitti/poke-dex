"use client";

import { useMemo, useState } from "react";
import BattleErrorToast from "./BattleErrorToast";
import BattleResultOverlay from "./BattleResultOverlay";
import DuelArena from "./DuelArena";
import LoadoutPicker from "./LoadoutPicker";
import { selectDuelView } from "./battleView";
import type { BattleDTO } from "./types";
import { useBattleRoom } from "./useBattleRoom";

// A sala é só a costura: hook (servidor) + view-model (puro) + arena (3D + HTML).
// Nenhuma regra de apresentação mora aqui — ela está em battleView.ts.
//
// A ESCOLHA DE SKILLS acontece aqui, em dois momentos, e os dois são "pôr o
// pokémon em campo":
//  - round 0 (preparação): a barra de quem abre a partida;
//  - toda troca: a barra de quem entra, submetida JUNTO com a troca.
// Ver o porquê do round 0 em resolveTurn.ts — não dá pra pausar o turno pra
// perguntar, então a escolha viaja com a ação.
export default function BattleRoom({
  battleId,
  myUserId,
  initialBattle,
}: {
  battleId: string;
  myUserId: string;
  initialBattle: BattleDTO;
}) {
  const { battle, error, submitting, playCard, playSwitch, playLead } = useBattleRoom(
    battleId,
    initialBattle
  );

  // Troca em curso: o slot escolhido, esperando a barra de skills.
  const [trocandoPara, setTrocandoPara] = useState<number | null>(null);

  const view = useMemo(() => selectDuelView(battle, myUserId), [battle, myUserId]);

  // Só acontece se a partida vier sem o participante/ativo esperado — a page já
  // garantiu que sou participante, então isso é defesa, não fluxo normal.
  if (!view) return null;

  const me = battle.participants.find((p) => p.userId === myUserId);
  const preparando = battle.round === 0 && battle.status === "IN_PROGRESS";
  const jaEnviei = battle.submittedUserIds.includes(myUserId);
  const nomeDoSlot = (slot: number) =>
    me?.pokemons.find((p) => p.slot === slot)?.name.replace(/-/g, " ") ?? "";

  return (
    <div className="relative h-full">
      <DuelArena
        view={view}
        submitting={submitting}
        onPlayCard={playCard}
        // A troca não vai direto: abre a escolha da barra de quem entra.
        onSwitch={setTrocandoPara}
      />

      {/* Preparação: ninguém ataca antes de os dois montarem a barra do líder. */}
      {preparando && me && !jaEnviei && (
        <LoadoutPicker
          key={`lead-${me.activeSlot}`}
          battleId={battleId}
          slot={me.activeSlot}
          pokemonName={nomeDoSlot(me.activeSlot)}
          title="Prepare seu pokémon"
          confirmLabel="Entrar em campo"
          submitting={submitting}
          onConfirm={playLead}
        />
      )}

      {preparando && jaEnviei && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-bg/70">
          <p className="font-title text-sm uppercase tracking-widest text-ink-dim">
            Aguardando o oponente preparar…
          </p>
        </div>
      )}

      {trocandoPara !== null && (
        <LoadoutPicker
          // Remonta a cada slot: é o que zera a escolha ao trocar de alvo.
          key={`switch-${trocandoPara}`}
          battleId={battleId}
          slot={trocandoPara}
          pokemonName={nomeDoSlot(trocandoPara)}
          title="Quem entra, entra com o quê?"
          confirmLabel="Trocar"
          submitting={submitting}
          onCancel={() => setTrocandoPara(null)}
          onConfirm={(loadout) => {
            playSwitch(trocandoPara, loadout);
            setTrocandoPara(null);
          }}
        />
      )}

      {error && <BattleErrorToast message={error} />}

      {view.isOver && (
        <BattleResultOverlay status={battle.status} iWon={view.iWon} isDraw={view.isDraw} />
      )}
    </div>
  );
}
