import { typeColor } from "@/lib/typeColors";

export default function TypeBadge({ type, small = false }: { type: string; small?: boolean }) {
  return (
    <span
      className={`inline-block rounded-full font-semibold uppercase tracking-wide text-white ${
        small ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-xs"
      }`}
      style={{ backgroundColor: typeColor(type), textShadow: "0 1px 2px rgba(0,0,0,.45)" }}
    >
      {type}
    </span>
  );
}
