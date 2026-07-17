"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabaseBrowser } from "@/src/lib/supabaseBrowser";
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
  // Canal Realtime assinado e saudável? Controla o ritmo do polling.
  const [live, setLive] = useState(false);

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
  useEffect(() => {
    if (latest.current.status !== "IN_PROGRESS") return;
    const supabase = getSupabaseBrowser();
    if (!supabase) return; // sem env do Supabase → segue 100% no polling

    let cancelled = false;
    let channel: RealtimeChannel | null = null;

    (async () => {
      // Sessão better-auth → JWT curto que o Realtime aceita. Se falhar
      // (secret ausente, 401...), não liga o canal — polling de 2s segura.
      const res = await fetch("/api/realtime/token");
      if (!res.ok || cancelled) return;
      const { token } = (await res.json()) as { token: string };

      await supabase.realtime.setAuth(token);
      if (cancelled) return;

      channel = supabase.channel(`battle:${battleId}`, {
        // private: exige a policy em realtime.messages (participante ↔ topic)
        config: { private: true },
      });
      channel.on("broadcast", { event: "battle_updated" }, () => {
        void loadFullState();
      });
      channel.subscribe((status) => {
        // Qualquer coisa que não seja SUBSCRIBED (erro, timeout, token
        // vencido → CLOSED) devolve o polling pro ritmo de motor (2s).
        if (!cancelled) setLive(status === "SUBSCRIBED");
      });
    })();

    return () => {
      cancelled = true;
      setLive(false);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [battleId, loadFullState]);

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
