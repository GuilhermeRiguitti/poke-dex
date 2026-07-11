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
