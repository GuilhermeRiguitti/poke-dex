import Link from "next/link";
import type { BattleStatusDTO } from "./types";

// Tela de vitória/derrota. Puramente apresentacional: o "Nova partida" é um
// <Link>, não um router.push — então esse componente não precisa de hook
// nenhum, e a sala não precisa mais do useRouter só por causa dele.
export default function BattleResultOverlay({
  status,
  iWon,
}: {
  status: BattleStatusDTO;
  iWon: boolean;
}) {
  const abandoned = status === "ABANDONED";
  const headline = abandoned ? (iWon ? "W.O." : "Abandono") : iWon ? "Vitória" : "Derrota";

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-bg/80 backdrop-blur-sm">
      <span
        className={`animate-ring-burst absolute h-48 w-48 rounded-full border-4 ${
          iWon ? "border-gold" : "border-bad"
        }`}
      />
      <div
        className={`plate animate-slam px-12 py-4 ${iWon ? "bg-gold" : "bg-bad"}`}
        style={{
          filter: iWon
            ? "drop-shadow(0 0 24px rgba(242,193,78,.5))"
            : "drop-shadow(0 0 24px rgba(255,92,92,.4))",
        }}
      >
        <span
          className={`plate-inner font-title text-6xl uppercase tracking-widest ${
            iWon ? "text-[#241a05]" : "text-white"
          }`}
        >
          {headline}
        </span>
      </div>

      {abandoned && (
        <p className="text-sm font-semibold text-ink-dim">
          {iWon ? "O oponente abandonou a partida." : "Você abandonou a partida."}
        </p>
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
