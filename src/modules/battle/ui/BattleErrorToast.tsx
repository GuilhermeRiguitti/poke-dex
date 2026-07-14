// Aviso de erro de jogada (turno desatualizado, troca inválida, etc).
export default function BattleErrorToast({ message }: { message: string }) {
  return (
    <div className="absolute left-1/2 top-4 -translate-x-1/2 rounded-lg bg-bad/90 px-4 py-2 text-sm font-bold text-white">
      {message}
    </div>
  );
}
