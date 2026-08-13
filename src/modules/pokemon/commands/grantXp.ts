import type { Prisma } from "@prisma/client";
import { applyXp, progressionFromXp } from "../domain/leveling";
import { evolutionTargetFor } from "../domain/evolution";

// Creditar XP num Pokémon do jogador — o que faz o nível SUBIR e, por
// consequência, o learnset LIBERAR cartas novas (domain/learnset.ts). Sem isto
// o nível seria decorativo: todo pokémon ficaria pra sempre no nível em que
// nasceu, com o mesmo punhado de cartas.
//
// Quem CALCULA quanto vale a vitória é quem paga — hoje só a batalha
// (battle/commands/awardBattleXp.ts monta o par vencedor/perdedor com a fórmula
// da série). Aqui é só a ESCRITA sobre UserPokemon, que é do pokémon: reescrever
// o par (xp, level) e evoluir se o nível bateu o gatilho.
//
// RECEBE `tx` E NÃO ABRE A PRÓPRIA TRANSAÇÃO. Não é detalhe: quem chama roda
// isto DENTRO da transação que encerra a partida, e é o claim otimista do
// `Battle` que garante que só UMA lambda chega aqui. Fora daquela transação,
// isto pagaria XP duplicado a cada polling de 2s.

export interface XpAward {
  userPokemonId: string;
  gainedXp: number;
}

/**
 * Aplica o XP. `xp` é o TOTAL acumulado e `level` é função dele (levelFromXp),
 * então os dois são reescritos juntos — não existe par (level, xp) inválido.
 *
 * Lê-e-escreve dentro da transação em vez de um `increment` atômico porque o
 * nível precisa ser RECALCULADO a partir do total novo, e isso não cabe num
 * update declarativo. A corrida que isso abriria (duas partidas do mesmo
 * pokémon terminando juntas) não existe: um jogador só está em uma partida por
 * vez (enqueueBattle barra).
 */
export async function grantXp(tx: Prisma.TransactionClient, awards: XpAward[]): Promise<void> {
  const payable = awards.filter((a) => a.gainedXp > 0);
  if (payable.length === 0) return;

  const rows = await tx.userPokemon.findMany({
    where: { id: { in: payable.map((a) => a.userPokemonId) } },
    select: {
      id: true,
      xp: true,
      pokemon: { select: { evolvesToApiId: true, evolvesToLevel: true } },
    },
  });

  for (const award of payable) {
    const row = rows.find((r) => r.id === award.userPokemonId);
    if (!row) continue; // pokémon solto da coleção no meio da partida
    const progress = applyXp(row.xp, award.gainedXp);
    await tx.userPokemon.update({
      where: { id: row.id },
      // `progressionFromXp` reafirma o par por construção. `applyXp` já devolve
      // os dois casados; passar pelo helper é o que impede um escritor futuro
      // de gravar só um dos campos.
      data: progressionFromXp(progress.xp),
    });
    // Evolução RETROATIVA: checa em toda aplicação de XP, não só quando subiu
    // de nível. Aqui não existe worker pra consertar estado depois (CLAUDE.md
    // §5), então o estado tem que se curar quando alguém chega — mesmo padrão
    // do timeout de turno. Sem isto, um pokémon que cruzou o gatilho enquanto a
    // espécie-alvo não estava no espelho ficava preso na forma antiga pra
    // sempre (no MAX_LEVEL nunca mais há nível ganho, então a checagem nunca
    // voltava).
    //
    // Custo ZERO no caso saudável: `evolutionTargetFor` é puro e devolve null
    // sem tocar no banco quando o nível não bate o gatilho da espécie atual —
    // e quem já evoluiu aponta pro estágio seguinte, cujo nível é mais alto.
    // A ida ao banco só acontece no caso que estava quebrado.
    //
    // NÃO toca no snapshot da partida (BattlePokemon é congelado): a evolução
    // vale da PRÓXIMA batalha, que reconstrói do UserPokemon.
    await maybeEvolve(tx, row.id, row.pokemon, progress.level);
  }
}

/**
 * Evolui o UserPokemon enquanto o nível bater o gatilho da espécie atual — em
 * cadeia (um XP grande pode cruzar Charmander→Charmeleon→Charizard de uma vez).
 * Troca `pokemonId` pela espécie nova. Para se o alvo não está no espelho
 * (seed parcial) — sem espécie de destino, não há pra onde evoluir.
 */
async function maybeEvolve(
  tx: Prisma.TransactionClient,
  userPokemonId: string,
  species: { evolvesToApiId: number | null; evolvesToLevel: number | null },
  level: number,
): Promise<void> {
  let current = species;
  // Guarda contra ciclo de dado ruim na cadeia (não deveria existir, mas o loop
  // seria infinito): o teto de evoluções por passada é curto.
  for (let step = 0; step < 5; step++) {
    const targetApiId = evolutionTargetFor(current, level);
    if (targetApiId == null) return;

    const next = await tx.pokemon.findUnique({
      where: { pokemonApiId: targetApiId },
      select: { id: true, evolvesToApiId: true, evolvesToLevel: true },
    });
    if (!next) return; // alvo fora do espelho

    // Evoluir é só trocar a espécie. Não há loadout guardado pra podar depois —
    // ver o bloco no fim deste arquivo.
    await tx.userPokemon.update({ where: { id: userPokemonId }, data: { pokemonId: next.id } });

    current = { evolvesToApiId: next.evolvesToApiId, evolvesToLevel: next.evolvesToLevel };
  }
}

// A PODA DE LOADOUT PÓS-EVOLUÇÃO SAIU (2026-08-02).
//
// Ela existia porque o deck guardava a barra de skills (DeckSlotCard): evoluir
// trocava a espécie, e as cartas que a espécie nova não conhecia viravam órfãs —
// era preciso apagá-las e repor o slot pra o pokémon não ficar injogável.
//
// Com a escolha movida pra dentro da batalha, não há barra guardada pra ficar
// órfã: o jogador monta contra o learnset da espécie ATUAL toda vez que põe o
// pokémon em campo. O problema deixou de existir em vez de ser resolvido.
