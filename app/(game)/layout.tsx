import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import NavBar from "@/components/NavBar";

// Tudo dentro de (game) exige sessão: sem login, redireciona server-side
// antes de renderizar qualquer coisa (as rotas de API continuam validando
// sessão por conta própria — isso aqui é a camada de UI).
export default async function GameLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  return (
    <>
      <NavBar userName={session.user.name} />
      <main className="mx-auto max-w-6xl px-4 pb-16">{children}</main>
    </>
  );
}
