import Link from "next/link";
import { CardsIcon, PokeballIcon, SwordsIcon } from "@/components/icons";
import SignOutButton from "@/components/SignOutButton";

export default function NavBar({ userName }: { userName: string }) {
  return (
    <header className="sticky top-0 z-40 border-b border-edge bg-bg/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="flex items-center gap-2.5">
          <PokeballIcon size={32} />
          <span className="text-lg font-extrabold tracking-tight">
            Poké<span className="text-poke">Arena</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/"
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-dim hover:bg-surface-2 hover:text-ink transition-colors"
          >
            <PokeballIcon size={16} />
            <span className="hidden sm:inline">PokéDex</span>
          </Link>
          <Link
            href="/pokedex"
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-dim hover:bg-surface-2 hover:text-ink transition-colors"
          >
            <CardsIcon size={16} />
            <span className="hidden sm:inline">Coleção</span>
          </Link>
          <Link
            href="/battle"
            className="flex items-center gap-1.5 rounded-lg bg-poke px-3 py-2 text-sm font-bold text-white hover:bg-poke-dark transition-colors"
          >
            <SwordsIcon size={16} />
            <span className="hidden sm:inline">Batalhar</span>
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <span className="hidden max-w-[140px] truncate text-sm text-ink-dim md:inline">{userName}</span>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
