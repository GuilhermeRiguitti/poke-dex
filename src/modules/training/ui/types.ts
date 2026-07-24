// Contrato de dados entre o servidor e a UI do treino (TM/tutor/ovo).
// Só interface — não pesa no bundle.

/** Resposta do POST /api/training/tm quando dá certo. */
export interface TeachTmResponseDTO {
  /** Move.id ensinado — a UI marca essa carta como desbloqueada. */
  moveId: string;
  /** saldo de tokens de TM depois do gasto. */
  tmTokens: number;
}
