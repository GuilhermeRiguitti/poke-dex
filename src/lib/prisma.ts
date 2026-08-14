// Marca de fronteira: importar isto de um componente cliente vira ERRO DE BUILD,
// não Prisma silenciosamente empacotado no bundle do browser. A regra "ui/ não
// importa Prisma" (CLAUDE.md) era só documentação até aqui — quem a cumpria era
// a disciplina de quem escrevia. Agora é o compilador.
import "server-only";

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
