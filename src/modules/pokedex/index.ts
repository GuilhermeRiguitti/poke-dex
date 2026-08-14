import "server-only";

// API pública do módulo pokedex — a LISTA: navegar, filtrar, ordenar e paginar
// a coleção do jogador e o catálogo. As rotas em app/api/** e as pages de
// (game) só devem importar daqui, nunca de domain/queries/commands direto.
//
// O pokémon EM SI (espelho da PokéAPI, ficha da espécie, nível, learnset,
// raridade, a carta desenhada) é do @/src/modules/pokemon. Aqui não se sabe o
// que é um nível — só se sabe ordenar por ele.
//
// Só código de SERVIDOR. Os componentes ficam em ui/ e são importados pelas
// pages por caminho direto: se um componente "use client" fosse reexportado por
// este barrel, toda rota de API que importa um command arrastaria a UI junto.

// Os DTOs da lista e os tipos dos filtros não saem daqui: quem os usa é a UI,
// que importa de types/domain por caminho relativo. O mesmo vale pras constantes
// de paginação e da paleta de filtros — quem desenha é o view ao lado delas.
export { clampPage } from "./domain/pagination";

// Todas as queries abaixo SÓ LEEM — podem ser chamadas do render de uma page.
export { listPokedexPage } from "./queries/listPokedexPage";
export { getCollectionQuery } from "./queries/getCollectionPage";
export { parseCollectionFilters, collectionHref } from "./domain/collectionFilters";

// A captura direta morreu — obter pokémon é só pelo módulo packs. Só resta a
// remoção (soltar uma carta da coleção).
export { removeCard } from "./commands/removeCard";

// O recorte + o mapper da CARTA da coleção. Saíram daqui pro módulo `trade`
// desenhar a carta ofertada com o mesmo contrato da coleção: a whitelist de
// campos é a parte que não pode divergir entre as duas telas, e duplicá-la seria
// abrir a porta pra uma delas passar a vazar um campo que a outra já barra.
export { COLLECTION_CARD_SELECT, toCollectionCardDTO } from "./queries/toCollectionPageDTO";
export type { CollectionCardDTO } from "./types";