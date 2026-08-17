import { battleTypeNames } from "./battleTypeNames";
import { loadBaseStats } from "./loadBaseStats";
import { loadTypeChart } from "./loadTypeChart";
import type { BattleDTOContext } from "./toBattleDTO";

interface ContextRow {
  participants: { userId: string; pokemons: { pokemonId: number; types: unknown; moves: unknown }[] }[];
}

/**
 * Carrega o que o DTO precisa do banco além da própria partida: a matriz de
 * efetividade e os base stats do time de QUEM está lendo.
 *
 * Mora num arquivo só porque os dois caminhos de leitura (`getBattleState` e
 * `readBattleState`) precisam do mesmo par — e se um deles esquecesse um dos
 * dois, a mesma tela mostraria selo de vantagem por um caminho e não pelo
 * outro, dependendo de o jogador ter chegado pela página ou pelo refetch.
 *
 * São duas consultas pequenas no espelho (`Type` ~18 linhas, `Pokemon` ≤6), em
 * paralelo, e FORA do caminho quente: quem bate aqui é a página e o refetch de
 * round. O polling de 2s é o `/status`, que devolve só contadores.
 */
export async function loadBattleDTOContext(
  battle: ContextRow,
  viewerUserId: string,
): Promise<BattleDTOContext> {
  const meus = battle.participants
    .filter((p) => p.userId === viewerUserId)
    .flatMap((p) => p.pokemons.map((m) => m.pokemonId));

  const [typeChart, baseStats] = await Promise.all([
    loadTypeChart(battleTypeNames(battle)),
    loadBaseStats(meus),
  ]);

  return { typeChart, viewer: { userId: viewerUserId, baseStats } };
}
