import { SwordsIcon } from "@/src/components/icons";

// Emblema da arena. Os anéis de radar só aparecem enquanto procura oponente —
// é por isso que ele precisa saber do `searching`, e é o motivo de ele não
// conseguir ser um irmão independente do card da fila (os dois leem o mesmo
// estado). Ver o comentário em BattleMatchmaker.
export default function QueueRadarEmblem({ searching }: { searching: boolean }) {
  return (
    <div className="relative flex h-24 w-24 items-center justify-center">
      {searching && (
        <>
          <span className="animate-radar absolute inset-0 rounded-full border-2 border-flare" />
          <span
            className="animate-radar absolute inset-0 rounded-full border-2 border-flare"
            style={{ animationDelay: "0.5s" }}
          />
        </>
      )}
      <div className="plate flex h-20 w-20 items-center justify-center border border-edge bg-panel">
        <span className="plate-inner">
          <SwordsIcon size={38} className="text-flare" />
        </span>
      </div>
    </div>
  );
}
