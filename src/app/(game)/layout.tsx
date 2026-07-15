import NavBar from "@/src/components/NavBar";
import { auth } from "@/src/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import DailyCheckIn from "@/src/modules/packs/ui/DailyCheckIn";



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
      {/* Dispara o check-in diário (streak de login) uma vez por carga. */}
      <DailyCheckIn />
    </>
  );
}
