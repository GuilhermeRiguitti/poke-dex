// O código que troca de mão. Regra pura: gerar, normalizar e dizer se venceu.
// Sem Prisma, sem fetch — quem persiste é o command.

/**
 * Alfabeto de Crockford: sem `I`, `L`, `O` e `U`, e sem os dígitos `0` e `1`.
 *
 * Não é purismo. O código é DITADO EM VOZ ALTA ou copiado à mão de um print —
 * `0`/`O` e `1`/`I`/`L` são o par que todo mundo erra, e um erro de digitação
 * aqui não dá "código errado" educado: dá uma tentativa a menos no freio de
 * força bruta. `U` sai por outro motivo: tirar a vogal reduz a chance de o
 * sorteio formar palavra ofensiva.
 */
export const TRADE_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";

/**
 * 8 caracteres em 30 símbolos ≈ 6,5×10¹¹ combinações (~2³⁹).
 *
 * O tamanho não é o que segura a força bruta sozinho — o freio de frequência é
 * (10 tentativas / 10 min por conta). Ele é o que garante que, mesmo com o
 * freio, adivinhar não é viável: nesse ritmo, varrer 1% do espaço levaria mais
 * de mil anos. Encurtar pra 6 já derrubaria isso pra algo que um bote de contas
 * alcança.
 */
export const TRADE_CODE_LENGTH = 8;

/** 24h. Oferta esquecida não fica de pé pra sempre prendendo a carta. */
export const TRADE_OFFER_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Sorteia um código. Recebe o `rng` em vez de chamar `Math.random` direto pra o
 * teste poder cravar a saída — mesmo motivo do rng injetado no motor de duelo.
 */
export function generateTradeCode(rng: () => number = Math.random): string {
  let code = "";
  for (let i = 0; i < TRADE_CODE_LENGTH; i++) {
    const index = Math.floor(rng() * TRADE_CODE_ALPHABET.length);
    // rng() === 1 (ou arredondamento infeliz) estouraria o índice e produziria
    // "undefined" no meio do código.
    code += TRADE_CODE_ALPHABET[Math.min(index, TRADE_CODE_ALPHABET.length - 1)];
  }
  return code;
}

/**
 * O que o jogador digita → o que está no banco. Só o que é SEGURO consertar:
 * espaço, hífen e caixa. Ele vai colar "a1b2-c3d4 " e isso não pode virar erro.
 *
 * Deliberadamente NÃO existe mapa de caractere parecido (`0`→`O`, `1`→`I`).
 * Seria a coisa errada a fazer aqui: como o alfabeto já removeu os dois lados de
 * cada par ambíguo, não há alvo correto pra onde mandar um `0` — mapear
 * chutaria, e chutar num código de 8 símbolos significa transformar um erro de
 * digitação em OUTRO CÓDIGO VÁLIDO, que pode ser a oferta de um terceiro. Entre
 * recusar e acertar a oferta errada, recusar.
 */
export function normalizeTradeCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[\s-]/g, "");
}

/** Só a FORMA. Não diz se existe — isso é ida ao banco. */
export function isValidCodeShape(code: string): boolean {
  if (code.length !== TRADE_CODE_LENGTH) return false;
  for (const c of code) {
    if (!TRADE_CODE_ALPHABET.includes(c)) return false;
  }
  return true;
}

export function isExpired(expiresAt: Date, now: Date): boolean {
  return expiresAt.getTime() <= now.getTime();
}

export function expiryFrom(now: Date): Date {
  return new Date(now.getTime() + TRADE_OFFER_TTL_MS);
}
