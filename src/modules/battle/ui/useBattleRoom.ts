"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BattleDTO } from "./types";

const POLL_INTERVAL_MS = 2000;

// Toda a conversa com o servidor durante o duelo vive aqui: o polling que
// descobre quando a vez virou (ou a partida acabou), e o envio da carta.
//
// Começa de `initialBattle`, que a page já buscou no servidor — sem estado de
// "carregando partida". Não há worker/cron: é a leitura que resolve o turno
// (resolveTurn.ts), então esse polling é o MOTOR do jogo, não só "atualizar".
//
// Detalhe do alternado: a vez pode virar SEM o round mudar (na 1ª ação de uma
// rodada, o round segue e só o activeUserId muda). Por isso o tick compara
// activeUserId TAMBÉM — comparar só o round perderia a virada pro meu turno.
export function useBattleRoom(battleId: string, initialBattle: BattleDTO) {
  const [battle, setBattle] = useState(initialBattle);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const latest = useRef({
    round: battle.round,
    status: battle.status,
    activeUserId: battle.activeUserId,
  });

  const applyBattle = useCallback((next: BattleDTO) => {
    setBattle(next);
    latest.current = { round: next.round, status: next.status, activeUserId: next.activeUserId };
  }, []);

  const loadFullState = useCallback(async () => {
    const res = await fetch(`/api/battle/${battleId}`);
    if (!res.ok) return;
    applyBattle((await res.json()) as BattleDTO);
  }, [battleId, applyBattle]);

  useEffect(() => {
    const timer = setInterval(async () => {
      if (latest.current.status !== "IN_PROGRESS") {
        clearInterval(timer);
        return;
      }
      if (document.hidden) return; // aba em segundo plano → economiza invocação

      const res = await fetch(`/api/battle/${battleId}/status`);
      if (!res.ok) return;
      const next = (await res.json()) as {
        round: number;
        status: BattleDTO["status"];
        activeUserId: string | null;
      };

      const prev = latest.current;
      if (prev.round !== next.round || prev.status !== next.status || prev.activeUserId !== next.activeUserId) {
        await loadFullState();
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [battleId, loadFullState]);

  const playCard = useCallback(
    async (cardSlot: number) => {
      setSubmitting(true);
      setError("");
      try {
        const res = await fetch(`/api/battle/${battleId}/move`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ round: battle.round, cardSlot }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Erro ao jogar");
          return;
        }
        applyBattle(data as BattleDTO);
      } finally {
        setSubmitting(false);
      }
    },
    [battleId, battle.round, applyBattle]
  );

  return { battle, error, submitting, playCard };
}
