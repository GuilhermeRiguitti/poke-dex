// Tabela de efetividade de tipo (ex: fogo é 2x contra grama). Isso é 100%
// dado real da PokéAPI (campo damage_relations do endpoint /type) — não
// inventamos nenhum multiplicador. A tabela é montada dinamicamente em
// snapshot.ts (buildTypeChart), buscando só os tipos que aparecem nos times
// da partida (corpo dos pokémon + tipo dos moves), em vez de baixar os 18
// tipos toda vez.
/** attackerType -> defenderType -> multiplicador (0, 0.5, 1 implícito, 2). Montada em runtime a partir de damage_relations da PokéAPI (ver Fase 3). */
export type TypeEffectivenessMap = Record<string, Record<string, number>>;

/** Produto dos multiplicadores contra cada tipo do defensor (1 ou 2 tipos). */
export function effectivenessMultiplier(
  chart: TypeEffectivenessMap,
  attackerType: string,
  defenderTypes: string[]
): number {
  return defenderTypes.reduce((acc, defType) => {
    const multiplier = chart[attackerType]?.[defType];
    return acc * (multiplier ?? 1);
  }, 1);
}
