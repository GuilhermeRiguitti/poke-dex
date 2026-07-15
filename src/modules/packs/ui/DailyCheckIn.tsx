"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PackIcon } from "@/src/components/icons";
import type { CheckInResult } from "../commands/checkInLogin";

// Dispara o check-in diário de login uma vez por carga (montado no layout de
// (game)). Não há worker — é este request que credita o streak. O command é
// idempotente por dia, então refires no mesmo dia são no-ops baratos; mesmo
// assim, um guard em sessionStorage evita bater na rota a cada hard reload.
//
// Quando um novo dia conta, dá router.refresh() pra atualizar o streak/bônus no
// dashboard. Quando o streak fecha um ciclo (7 dias), mostra um toast do bônus.

const STORAGE_KEY = "poke:lastCheckInDay";

function utcDayKey(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

export default function DailyCheckIn() {
  const router = useRouter();
  const [toast, setToast] = useState<{ streak: number } | null>(null);

  useEffect(() => {
    const today = utcDayKey();
    if (sessionStorage.getItem(STORAGE_KEY) === today) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/packs/checkin", { method: "POST" });
        if (!res.ok) return;
        const result = (await res.json()) as CheckInResult;
        if (cancelled) return;

        sessionStorage.setItem(STORAGE_KEY, today);

        if (result.checkedIn) {
          if (result.awardedPack) setToast({ streak: result.streak });
          router.refresh(); // atualiza o dashboard (streak/bônus)
        }
      } catch {
        // silencioso: check-in é oportunista, não pode atrapalhar a navegação
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(id);
  }, [toast]);

  if (!toast) return null;

  return (
    <div
      className="animate-rise clip-card fixed bottom-4 right-4 z-50 flex items-center gap-3 border border-gold/60 bg-panel p-4 shadow-2xl"
      role="status"
      style={{ borderTopColor: "var(--color-gold)", borderTopWidth: 3 }}
    >
      <PackIcon size={32} className="text-gold" />
      <div>
        <p className="font-title text-sm uppercase tracking-wide text-gold">
          🔥 {toast.streak} dias seguidos!
        </p>
        <p className="text-xs font-semibold text-ink-dim">Você ganhou 1 pacote-bônus.</p>
      </div>
    </div>
  );
}
