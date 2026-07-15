import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/src/lib/auth";
import { PackIcon } from "@/src/components/icons";
import { readPackState } from "@/src/modules/packs";
import { streakView } from "@/src/modules/packs/ui/packView";

// A home é o (futuro) DASHBOARD. Por ora é um placeholder enxuto: saudação + o
// status do pacote diário, que é o loop central do jogo, com atalho pra abrir.
// O grid dos 1025 que morava aqui virou a rota /catalog (view-only). Widgets de
// dashboard (coleção, histórico de batalha, streak) entram aqui depois.
//
// Page é servidor: lê o estado do pacote no banco e passa pintado. Sem "use
// client", sem fetch de cliente, sem estado de loading.
export default async function HomePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const packState = await readPackState(session.user.id);
  const streak = streakView(packState.loginStreak);

  return (
    <div className="pt-8">
      <div className="mb-8">
        <h1 className="font-title text-3xl uppercase tracking-wide">
          Olá, <span className="text-energy">{session.user.name}</span>
        </h1>
        <p className="text-sm font-semibold text-ink-dim">
          Seu dashboard está em construção. Enquanto isso, seu pacote te espera.
        </p>
      </div>

      {streak.streak > 0 && (
        <div className="clip-card mb-6 flex max-w-md items-center gap-3 border border-edge bg-panel-2 px-4 py-3">
          <span className="font-title text-2xl text-gold">🔥 {streak.streak}</span>
          <div className="text-sm">
            <p className="font-title uppercase tracking-wide">dias seguidos</p>
            <p className="text-xs font-semibold text-ink-dim">
              {streak.untilReward === streak.cycle
                ? "Bônus liberado hoje!"
                : `Faltam ${streak.untilReward} para o próximo pacote-bônus.`}
            </p>
          </div>
        </div>
      )}

      <Link
        href="/packs"
        className="card-frame clip-card group flex max-w-md items-center gap-4 p-5"
        style={{ "--type-c": "var(--color-flare)" } as React.CSSProperties}
      >
        <PackIcon
          size={48}
          className={`text-flare ${packState.canOpen ? "animate-playable-pulse" : ""}`}
        />
        <div className="flex-1">
          <p className="font-title text-lg uppercase tracking-wide">
            {packState.canOpen ? "Pacote disponível" : "Pacote em espera"}
          </p>
          <p className="text-sm font-semibold text-ink-dim">
            {packState.canOpen
              ? "Abra e ganhe 6 cartas."
              : "Volte mais tarde para o próximo pacote grátis."}
            {packState.extraPacks > 0 && (
              <span className="text-gold"> · {packState.extraPacks} bônus</span>
            )}
          </p>
        </div>
        <span className="font-title text-2xl text-flare transition-transform group-hover:translate-x-1">
          →
        </span>
      </Link>

      <div className="clip-card mt-6 max-w-md border border-dashed border-edge p-6 text-center">
        <p className="font-title text-sm uppercase tracking-wide text-ink-dim">
          Dashboard em breve
        </p>
        <p className="mt-1 text-xs font-semibold text-ink-dim">
          Coleção, histórico de batalhas e recompensas de login aparecerão aqui.
        </p>
      </div>
    </div>
  );
}
