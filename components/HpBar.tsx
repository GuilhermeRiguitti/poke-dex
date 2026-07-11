// Barra de HP segmentada (estilo barra de EXP de MMORPG).
// `tone` força uma cor fixa; sem ela, a cor segue o percentual de vida.
export default function HpBar({
  current,
  max,
  tone,
}: {
  current: number;
  max: number;
  tone?: "energy" | "flare" | "gold";
}) {
  const pct = Math.max(0, Math.min(100, (current / max) * 100));
  const color = tone
    ? { energy: "bg-energy", flare: "bg-flare", gold: "bg-gold" }[tone]
    : pct > 50
      ? "bg-ok"
      : pct > 20
        ? "bg-warn"
        : "bg-bad";

  return (
    <div className="bar-track h-3 w-full">
      <div className={`bar-fill ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
