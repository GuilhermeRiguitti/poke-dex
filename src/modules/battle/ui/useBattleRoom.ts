"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRealtimeChannel } from "@/src/modules/realtime/ui/useRealtimeChannel";
import type { BattleDTO } from "./types";

// Sem Realtime, o polling é o MOTOR do jogo (a leitura resolve o turno —
// resolveTurn.ts; não há worker). Com Realtime de pé ele vira rede de
// segurança: o push chega na hora e o poll lento só cobre mensagem perdida
// (Realtime NUNCA é autoritativo — CLAUDE.md consequência #1).
const POLL_INTERVAL_MS = 2000;
const REALTIME_FALLBACK_POLL_MS = 20_000;

// Eventos do canal battle:<id>. Os dois só dizem "algo mudou" — quem lê o
// estado é sempre o GET que passa pelo DTO.
//  - battle_updated:  o turno resolveu (o Battle mudou de round/status).
//  - battle_action_submitted: alguém trancou a carta do round.
// O segundo é o que o SIMULTÂNEO exigiu: quando o oponente escolhe, nenhuma
// linha do Battle muda — sem esse trigger, o "oponente pronto" só apareceria
// no próximo poll (até 20s depois, com o canal de pé).
const CHANNEL_EVENTS = ["battle_updated", "battle_action_submitted"];

// Toda a conversa com o servidor durante o duelo vive aqui: o push do
// Realtime + polling que descobrem quando o round virou (ou a partida acabou),
// e o envio da carta.
//
// Começa de `initialBattle`, que a page já buscou no servidor — sem estado de
// "carregando partida".
//
// Realtime é SINAL, não DADO: o trigger empurra um payload mínimo e o cliente
// refaz o GET que passa pelo DTO. Por isso o handler nem lê o payload —
// qualquer sinal no canal = refetch (idempotente).
export function useBattleRoom(battleId: string, initialBattle: BattleDTO) {
  const [battle, setBattle] = useState(initialBattle);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const latest = useRef({
    round: battle.round,
    status: battle.status,
    submittedCount: battle.submittedUserIds.length,
  });

  const applyBattle = useCallback((next: BattleDTO) => {
    setBattle(next);
    latest.current = {
      round: next.round,
      status: next.status,
      submittedCount: next.submittedUserIds.length,
    };
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
    CHANNEL_EVENTS,
    loadFullState,
    battle.status === "IN_PROGRESS"
  );

  // ── Polling: motor sem Realtime, rede de segurança com ele ──────────────
  //
  // O tick compara round + status + QUANTOS já submeteram. O terceiro não é
  // enfeite: no simultâneo o oponente trancar a carta não muda o round nem o
  // status, e sem isso a tela ficaria mentindo "oponente escolhendo" até o
  // turno inteiro resolver.
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
        iSubmitted: boolean;
        opponentSubmitted: boolean;
      };

      const prev = latest.current;
      const submittedCount = (next.iSubmitted ? 1 : 0) + (next.opponentSubmitted ? 1 : 0);
      if (prev.round !== next.round || prev.status !== next.status || prev.submittedCount !== submittedCount) {
        await loadFullState();
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [battleId, loadFullState, live]);

  // ── Vencimento do turno: um request no instante em que a janela fecha ──────
  //
  // O turno vencido só resolve quando ALGUÉM faz request (não há worker). Com o
  // canal de Realtime de pé o polling relaxa pra 20s, então o relógio da tela
  // chegaria a zero e o round ficaria parado em "resolvendo…" por até um quarto
  // de minuto. Este timeout dispara UM refetch no vencimento — e o GET resolve o
  // turno no servidor (getBattleState).
  //
  // Uma vez por round, guardado pelo ref: se por algum motivo o refetch não
  // resolver, quem cobre é o polling normal (e o pg_cron), sem virar um laço de
  // requests de 300ms.
  const expireFiredFor = useRef<number | null>(null);
  useEffect(() => {
    if (battle.status !== "IN_PROGRESS") return;
    if (expireFiredFor.current === battle.round) return;

    const timer = setTimeout(() => {
      expireFiredFor.current = battle.round;
      if (document.hidden) return; // aba escondida → deixa com o backstop do cron
      void loadFullState();
    }, battle.turnEndsInMs + 300);

    return () => clearTimeout(timer);
  }, [battle.status, battle.round, battle.turnEndsInMs, loadFullState]);

  // Envio da jogada — golpe (MOVE) ou troca (SWITCH). O servidor guarda o
  // segredo e resolve o turno se o outro lado também já jogou.
  const submit = useCallback(
    async (
      body:
        | { type: "MOVE"; cardSlot: number }
        | { type: "SWITCH"; targetSlot: number; loadout?: string[] }
        | { type: "LEAD"; loadout: string[] }
    ) => {
      setSubmitting(true);
      setError("");
      try {
        const res = await fetch(`/api/battle/${battleId}/move`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ round: battle.round, ...body }),
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

  const playCard = useCallback((cardSlot: number) => submit({ type: "MOVE", cardSlot }), [submit]);
  // A troca leva a barra de skills de quem ENTRA: montar o loadout virou parte
  // de pôr o pokémon em campo, e viaja na mesma submissão às cegas.
  const playSwitch = useCallback(
    (targetSlot: number, loadout?: string[]) => submit({ type: "SWITCH", targetSlot, loadout }),
    [submit]
  );
  /** Round 0: a barra do pokémon que abre a partida. */
  const playLead = useCallback((loadout: string[]) => submit({ type: "LEAD", loadout }), [submit]);

  return { battle, error, submitting, playCard, playSwitch, playLead, live };
}
