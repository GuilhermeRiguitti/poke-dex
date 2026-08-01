// Regra de apresentação da paginação. Pura e testada — componente é costura
// (CLAUDE.md, regra 4).

export interface PaginationView {
  prevPage: number;
  nextPage: number;
  prevDisabled: boolean;
  nextDisabled: boolean;
  /** a página atual, dois dígitos */
  label: string;
  /** o total, dois dígitos */
  totalLabel: string;
}

export function paginationView(page: number, totalPages: number): PaginationView {
  return {
    prevPage: page - 1,
    nextPage: page + 1,
    prevDisabled: page <= 1,
    // `>=` e não `===`: o parser dos filtros não recorta o teto (só a query
    // sabe o total), então uma página além do fim chega aqui de verdade.
    nextDisabled: page >= totalPages,
    label: String(page).padStart(2, "0"),
    totalLabel: String(totalPages).padStart(2, "0"),
  };
}
