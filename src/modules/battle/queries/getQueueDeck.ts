import { getDeckSummary } from "@/src/modules/deck";
import type { QueueDeckDTO } from "../ui/types";

// O deck do usuário como a tela da fila precisa dele. A página lê isso no
// servidor, então não há flash de "Carregando seu deck...".
//
// Antes, este arquivo tinha a própria cópia do findFirst-com-orderBy-ou-create,
// igualzinha à do GET /api/deck — mesma corrida, mesmo comentário copiado nos
// dois lugares. Agora quem sabe o que é "o deck do usuário" (e como conviver
// com o Deck.userId sem @unique) é o módulo deck, num arquivo só; aqui só
// sobra a tradução pro contrato da UI da fila.
export async function getQueueDeck(userId: string): Promise<QueueDeckDTO> {
  const summary = await getDeckSummary(userId);
  return { id: summary.id, name: summary.name, slotCount: summary.slotCount };
}
