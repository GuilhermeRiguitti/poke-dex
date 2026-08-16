import type { BattleMoveDef } from "../domain/types";

/**
 * Os nomes de tipo que a partida usa: corpo dos pokémon + tipo das cartas.
 * Serve pra pedir ao espelho só o pedaço da matriz que interessa, em vez dos 18
 * tipos toda vez. Estrutural de propósito — vale pra qualquer linha lida com os
 * `include` da batalha, e `types`/`moves` são colunas Json escritas pelo
 * buildDuelSnapshot (o cast é a leitura desse contrato).
 */
export function battleTypeNames(battle: {
  participants: { pokemons: { types: unknown; moves: unknown }[] }[];
}): Set<string> {
  const names = new Set<string>();
  for (const p of battle.participants) {
    for (const mon of p.pokemons) {
      for (const t of ((mon.types as string[]) ?? [])) names.add(t);
      for (const mv of ((mon.moves as BattleMoveDef[]) ?? [])) names.add(mv.type);
    }
  }
  return names;
}
