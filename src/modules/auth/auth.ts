import "server-only";

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/src/lib/prisma";

// Só `emailAndPassword` está ligado. Se um dia entrar login social, os campos
// `accessToken`/`refreshToken`/`idToken` do `Account` — hoje todos NULL, existem
// só porque o prismaAdapter espera esse shape — passam a guardar token de
// terceiro em texto plano, e aí vale pensar em criptografia (TODO.md § SEGURANCA).
export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  // Sem isto o better-auth adivinha a origem pelo header do request, e quem
  // manda o header é o cliente. Em produção a URL é fixa e conhecida — declarar
  // é o que faz o link de callback e a checagem de origem apontarem pro lugar
  // certo mesmo atrás do proxy da Vercel.
  baseURL: process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL,

  // Lista branca de origens que podem falar com a API de auth (defesa de CSRF).
  // O preview da Vercel tem domínio gerado por deploy, por isso a variável — em
  // dev, localhost.
  trustedOrigins: [
    ...(process.env.BETTER_AUTH_URL ? [process.env.BETTER_AUTH_URL] : []),
    ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
    "http://localhost:3000",
  ],

  emailAndPassword: {
    enabled: true,
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 dias
    // Só reescreve a sessão se ela tiver mais de 1 dia. Sem isto o better-auth
    // atualiza a linha a CADA request — e aqui todo poll de 2s da batalha passa
    // por `getSession`, ou seja, seria uma escrita por segundo por partida só
    // pra carimbar a data.
    updateAge: 60 * 60 * 24,
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },

  // Freio de força bruta no sign-in. `storage: "database"` e NÃO o default
  // ("memory"): memória não sobrevive à lambda, então o contador em memória
  // zeraria a cada invocação e o freio não freia nada (CLAUDE.md consequência
  // #1). Grava no model `RateLimit` — o mesmo que o `lib/rateLimit.ts` das
  // rotas do app usa, com prefixo de chave diferente.
  rateLimit: {
    enabled: true,
    window: 60,
    max: 60,
    storage: "database",
    customRules: {
      // O caminho que um ataque de senha percorre merece teto próprio, bem
      // abaixo do geral.
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60 * 60, max: 10 },
      "/forget-password": { window: 60 * 60, max: 5 },
    },
  },
});
