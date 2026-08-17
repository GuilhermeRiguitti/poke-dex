import { auth } from "@/src/modules/auth/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

// A ARENA é o único lugar do jogo SEM navbar. Ela existe como grupo de rota
// próprio por isso: o palco 3D é a tela inteira, e uma barra de navegação em
// cima dele rouba altura do cenário e ainda oferece "sair" no meio de uma
// partida que não pausa (o turno vence com ou sem o jogador olhando).
//
// O que este layout NÃO faz, de propósito:
// - **NavBar**: ver acima.
// - **DailyCheckIn**: é do (game). Aqui ele dispararia um POST no meio do duelo,
//   competindo com o polling de 2s por invocação de lambda.
//
// A sessão continua obrigatória — a página também confere (ela precisa do
// userId), mas o portão fica aqui pelo mesmo motivo do (game): redirecionar
// antes de renderizar qualquer coisa.
export default async function ArenaLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  return children;
}
