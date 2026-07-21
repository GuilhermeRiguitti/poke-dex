"use client";

import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabaseBrowser } from "./supabaseBrowser";

// Assina um canal privado do Supabase Realtime e chama `onMessage` a cada
// broadcast do `event` no `topic`. Devolve `live`: true só enquanto o canal
// está SUBSCRIBED e saudável.
//
// Realtime é SINAL, não DADO: este hook NUNCA lê o payload do broadcast — só
// avisa "chegou algo". Quem consome refaz o GET que passa pelo DTO (o refetch
// é idempotente, então sinal duplicado não importa). Ver PLANO_JOGO.md §8.1.
//
// Fail-safe, não fail-broken: sem env do Supabase (getSupabaseBrowser → null),
// token 401/503, ou qualquer erro no canal, `live` fica false e quem consome
// segue no polling. O Realtime só faz o polling relaxar; nunca é autoritativo.
export function useRealtimeChannel(
  topic: string,
  event: string,
  onMessage: () => void,
  enabled: boolean
): boolean {
  const [live, setLive] = useState(false);

  // Guarda o callback num ref pra trocar de handler não re-assinar o canal.
  const onMessageRef = useRef(onMessage);
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    if (!enabled) return;
    const supabase = getSupabaseBrowser();
    if (!supabase) return; // sem env do Supabase → quem consome fica no polling

    let cancelled = false;
    let channel: RealtimeChannel | null = null;

    (async () => {
      // Sessão better-auth → JWT curto que o Realtime aceita. Se falhar
      // (secret ausente, 401...), não liga o canal — o polling segura.
      const res = await fetch("/api/realtime/token");
      if (!res.ok || cancelled) return;
      const { token } = (await res.json()) as { token: string };

      await supabase.realtime.setAuth(token);
      if (cancelled) return;

      channel = supabase.channel(topic, {
        // private: exige a policy em realtime.messages (participante ↔ topic)
        config: { private: true },
      });
      channel.on("broadcast", { event }, () => onMessageRef.current());
      channel.subscribe((status) => {
        // Qualquer coisa que não seja SUBSCRIBED (erro, timeout, token
        // vencido → CLOSED) faz `live` cair, e quem consome volta pro polling.
        if (!cancelled) setLive(status === "SUBSCRIBED");
      });
    })();

    return () => {
      cancelled = true;
      setLive(false);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [topic, event, enabled]);

  return live;
}
