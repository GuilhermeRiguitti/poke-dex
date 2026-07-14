"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BattleDTO } from "./types";

const POLL_INTERVAL_MS = 2000;

export interface BattleAction {
  actionType: "MOVE" | "SWITCH";
  moveSlot?: number;
  switchToSlot?: number;
}

// Toda a conversa com o servidor durante a partida vive aqui: o polling que
// descobre quando o turno virou, e o envio da jogada.
//
// Começa de `initialBattle`, que a page já buscou no servidor — por isso não
// existe mais estado de "carregando partida".
//
// Não há worker/cron no backend: é a leitura que resolve o turno (ver
// resolveTurn.ts). Então esse polling não é só "atualizar a tela", ele é o
// que empurra a partida pra frente.
export function useBattleRoom(battleId: string, initialBattle: BattleDTO) {
  const [battle, setBattle] = useState(initialBattle);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // "waiting" = eu já joguei e o turno não virou → estou esperando o oponente.
  const [waiting, setWaiting] = useState(false);

  // O tick do polling lê o estado por ref pra não precisar se reinscrever
  // (recriar o interval) a cada turno.
  const latest = useRef({ turnNumber: battle.currentTurn, status: battle.status });

  const applyBattle = useCallback((next: BattleDTO) => {
    setBattle(next);
    latest.current = { turnNumber: next.currentTurn, status: next.status };
  }, []);

  const loadFullState = useCallback(async () => {
    const res = await fetch(`/api/battle/${battleId}`);
    if (!res.ok) return;
    applyBattle((await res.json()) as BattleDTO);
    setWaiting(false);
  }, [battleId, applyBattle]);

  useEffect(() => {
    const timer = setInterval(async () => {
      // Partida encerrada → não há mais o que atualizar.
      if (latest.current.status !== "IN_PROGRESS") {
        clearInterval(timer);
        return;
      }
      // Aba em segundo plano → pula o tick (economiza invocação na Vercel).
      if (document.hidden) return;

      // GET /status é o polling leve; só busca o estado completo quando o
      // turno virou (ou a partida acabou).
      const res = await fetch(`/api/battle/${battleId}/status`);
      if (!res.ok) return;
      const { turnNumber, status } = (await res.json()) as {
        turnNumber: number;
        status: BattleDTO["status"];
      };

      const prev = latest.current;
      if (prev.turnNumber !== turnNumber || prev.status !== status) {
        await loadFullState();
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [battleId, loadFullState]);

  const submitAction = useCallback(
    async (turnNumber: number, action: BattleAction) => {
      setSubmitting(true);
      setError("");
      try {
        const res = await fetch(`/api/battle/${battleId}/move`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ turnNumber, ...action }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Erro ao jogar");
          return;
        }

        const next = data as BattleDTO;
        applyBattle(next);
        // O turno não virou com a minha jogada → o oponente ainda não jogou.
        setWaiting(next.currentTurn === turnNumber && next.status === "IN_PROGRESS");
      } finally {
        setSubmitting(false);
      }
    },
    [battleId, applyBattle]
  );

  return { battle, error, waiting, submitting, submitAction };
}
