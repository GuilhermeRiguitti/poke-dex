import { typeColor } from "@/lib/typeColors";

export default function TypeBadge({ type, small = false }: { type: string; small?: boolean }) {
  return (
    <span
      className={`plate inline-block font-bold uppercase tracking-wider text-white ${
        small ? "px-2 py-px text-[10px]" : "px-3 py-0.5 text-xs"
      }`}
      style={{ backgroundColor: typeColor(type), textShadow: "0 1px 2px rgba(0,0,0,.5)" }}
    >
      <span className="plate-inner">{type}</span>
    </span>
  );
}
