"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CardsIcon, PokeballIcon, SwordsIcon } from "@/components/icons";
import SignOutButton from "@/components/SignOutButton";

const LINKS = [
  { href: "/", label: "PokéDex", icon: PokeballIcon },
  { href: "/pokedex", label: "Coleção", icon: CardsIcon },
] as const;

export default function NavBar({ userName }: { userName: string }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-edge bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="group flex items-center gap-2.5">
          <PokeballIcon size={30} />
          <span className="plate bg-panel-2 border border-edge px-3 py-1 transition-colors group-hover:border-energy/60">
            <span className="plate-inner font-title text-lg tracking-wide">
              POKÉ<span className="text-flare">ARENA</span>
            </span>
          </span>
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`clip-btn flex items-center gap-1.5 px-3 py-2 text-sm font-semibold uppercase tracking-wide transition-colors ${
                  active
                    ? "bg-panel-2 text-energy"
                    : "text-ink-dim hover:bg-panel-2 hover:text-ink"
                }`}
              >
                <Icon size={15} />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
          <Link
            href="/battle"
            className={`clip-btn flex items-center gap-1.5 px-4 py-2 text-sm font-bold uppercase tracking-wide text-white transition-colors ${
              pathname.startsWith("/battle")
                ? "bg-flare-dark"
                : "bg-flare hover:bg-flare-dark"
            }`}
          >
            <SwordsIcon size={15} />
            <span className="hidden sm:inline">Batalhar</span>
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <span className="hidden max-w-[140px] truncate text-sm font-semibold text-ink-dim md:inline">
            {userName}
          </span>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
