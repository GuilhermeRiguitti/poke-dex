import DetailPanel from "./DetailPanel";

// Os movimentos que a tela mostra. Não é o movepool inteiro: o DTO já corta em
// DETAIL_MOVES_SHOWN (ver queries/toPokemonDTO) — o Rattata tem ~130 moves e
// mandar todos pro cliente seria centenas de KB pra desenhar 12 chips.
// `totalMoves` é o tamanho real, e é só o que a tela diz do resto.

export default function PokemonMoves({
  moveNames,
  totalMoves,
}: {
  moveNames: string[];
  totalMoves: number;
}) {
  return (
    <DetailPanel title="Alguns movimentos" hint={`(${totalMoves} no total)`} delayMs={160}>
      <div className="flex flex-wrap gap-2">
        {moveNames.map((move) => (
          <span
            key={move}
            className="clip-btn border border-edge px-3 py-1 text-xs font-bold uppercase tracking-wide text-ink-dim"
          >
            {move}
          </span>
        ))}
      </div>
    </DetailPanel>
  );
}
