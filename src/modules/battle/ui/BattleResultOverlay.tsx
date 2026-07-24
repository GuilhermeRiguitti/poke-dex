import Link from "next/link";
import type { BattleStatusDTO } from "./types";

// Tela de vitória/derrota. Puramente apresentacional: o "Nova partida" é um
// <Link>, não um router.push — então esse componente não precisa de hook
// nenhum, e a sala não precisa mais do useRouter só por causa dele.
export default function BattleResultOverlay({
  status,
  iWon,
  isDraw = false,
}: {
  status: BattleStatusDTO;
  iWon: boolean;
  isDraw?: boolean;
}) {
  const abandoned = status === "ABANDONED";
  const headline = isDraw
    ? "Empate"
    : abandoned
      ? iWon
        ? "W.O."
        : "Abandono"
      : iWon
        ? "Vitória"
        : "Derrota";

  // Empate é neutro (nem ouro nem vermelho); vitória em ouro, derrota em vermelho.
  const positive = iWon && !isDraw;
  const ring = isDraw ? "border-ink-dim" : positive ? "border-gold" : "border-bad";
  const plateBg = isDraw ? "bg-panel-2" : positive ? "bg-gold" : "bg-bad";
  const plateText = isDraw ? "text-ink" : positive ? "text-[#241a05]" : "text-white";
  const glow = positive
    ? "drop-shadow(0 0 24px rgba(242,193,78,.5))"
    : isDraw
      ? "none"
      : "drop-shadow(0 0 24px rgba(255,92,92,.4))";

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-bg/80 backdrop-blur-sm">
      <span className={`animate-ring-burst absolute h-48 w-48 rounded-full border-4 ${ring}`} />
      <div className={`plate animate-slam px-12 py-4 ${plateBg}`} style={{ filter: glow }}>
        <span className={`plate-inner font-title text-6xl uppercase tracking-widest ${plateText}`}>
          {headline}
        </span>
      </div>

      {abandoned && !isDraw && (
        <p className="text-sm font-semibold text-ink-dim">
          {iWon ? "O oponente abandonou a partida." : "Você abandonou a partida."}
        </p>
      )}
      {isDraw && (
        <p className="text-sm font-semibold text-ink-dim">Os dois times foram nocauteados.</p>
      )}

      <Link
        href="/battle"
        className="clip-btn cursor-pointer border-0 bg-flare px-6 py-2.5 font-title uppercase tracking-wider text-white transition-colors hover:bg-flare-dark"
      >
        Nova partida
      </Link>
    </div>
  );
}
