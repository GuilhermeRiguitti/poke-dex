"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRealtimeChannel } from "@/src/modules/realtime/ui/useRealtimeChannel";
import type { BattleDTO } from "./types";

// Sem Realtime, o polling é o MOTOR do jogo (a leitura resolve o turno —
// resolveTurn.ts; não há worker). Com Realtime de pé ele vira rede de
// segurança: o push chega na hora e o poll lento só cobre mensagem perdida
// (Realtime NUNCA é autoritativo — PLANO_JOGO.md §8.1).
const POLL_INTERVAL_MS = 2000;
const REALTIME_FALLBACK_POLL_MS = 20_000;

// Toda a conversa com o servidor durante o duelo vive aqui: o push do
// Realtime + polling que descobrem quando a vez virou (ou a partida acabou),
// e o envio da carta.
//
// Começa de `initialBattle`, que a page já buscou no servidor — sem estado de
// "carregando partida".
//
// Realtime é SINAL, não DADO: o trigger no Battle empurra um payload mínimo
// e o cliente refaz o GET que passa pelo DTO. Por isso o handler do broadcast
// nem lê o payload — qualquer sinal no canal = refetch (idempotente).
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

  // ── Realtime: push → refetch ─────────────────────────────────────────────
  // Canal privado battle:<id>; qualquer broadcast = refetch (idempotente). O
  // `live` que volta controla o ritmo do polling abaixo. Só assina enquanto a
  // partida está em progresso — acabou, o canal cai e o polling para.
  const live = useRealtimeChannel(
    `battle:${battleId}`,
    "battle_updated",
    loadFullState,
    battle.status === "IN_PROGRESS"
  );

  // ── Polling: motor sem Realtime, rede de segurança com ele ──────────────
  useEffect(() => {
    const intervalMs = live ? REALTIME_FALLBACK_POLL_MS : POLL_INTERVAL_MS;
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
    }, intervalMs);

    return () => clearInterval(timer);
  }, [battleId, loadFullState, live]);

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

  return { battle, error, submitting, playCard, live };
}
