"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  PokeballIcon,
  CardsIcon,
  SwordsIcon,
  PackIcon,
  GridIcon,
  MenuIcon,
  CloseIcon,
} from "./icons";
import SignOutButton from "./SignOutButton";


const LINKS = [
  { href: "/packs", label: "Pacotes", icon: PackIcon },
  { href: "/catalog", label: "Catálogo", icon: GridIcon },
  { href: "/pokedex", label: "Coleção", icon: CardsIcon },
] as const;

export default function NavBar({ userName }: { userName: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  // Trava o scroll do fundo e fecha no Escape enquanto o drawer está aberto.
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const battleActive = pathname.startsWith("/battle");

  return (
    <header className="sticky top-0 z-40 border-b border-edge bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="group flex items-center gap-2.5">
          <PokeballIcon size={30} />
          <span className="plate bg-panel-2 border border-edge px-3 py-1 transition-colors group-hover:border-energy/60">
            <span className="plate-inner font-title text-lg tracking-wide">
              POKE<span className="text-flare">DEX</span>
            </span>
          </span>
        </Link>

        {/* ── Nav desktop (some no mobile) ─────────────────────────────── */}
        <nav className="hidden items-center gap-1 sm:flex sm:gap-2">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`clip-btn flex items-center gap-1.5 px-3 py-2 text-sm font-semibold uppercase tracking-wide transition-colors ${
                  active ? "bg-panel-2 text-energy" : "text-ink-dim hover:bg-panel-2 hover:text-ink"
                }`}
              >
                <Icon size={15} />
                <span>{label}</span>
              </Link>
            );
          })}
          <Link
            href="/battle"
            className={`clip-btn flex items-center gap-1.5 px-4 py-2 text-sm font-bold uppercase tracking-wide text-white transition-colors ${
              battleActive ? "bg-flare-dark" : "bg-flare hover:bg-flare-dark"
            }`}
          >
            <SwordsIcon size={15} />
            <span>Batalhar</span>
          </Link>
        </nav>

        <div className="hidden items-center gap-3 sm:flex">
          <span className="hidden max-w-[140px] truncate text-sm font-semibold text-ink-dim md:inline">
            {userName}
          </span>
          <SignOutButton />
        </div>

        {/* ── Gatilho mobile (some no desktop) ─────────────────────────── */}
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir menu"
          aria-expanded={open}
          className="clip-btn flex items-center justify-center border border-edge bg-panel-2 p-2.5 text-ink transition-colors hover:border-energy/60 hover:text-energy sm:hidden"
        >
          <MenuIcon size={20} />
        </button>
      </div>

      {/* ── Drawer off-canvas (só mobile) ──────────────────────────────── */}
      <div
        className={`fixed inset-0 z-50 sm:hidden ${open ? "" : "pointer-events-none"}`}
        aria-hidden={!open}
      >
        {/* backdrop */}
        <div
          onClick={() => setOpen(false)}
          className={`absolute inset-0 bg-bg/75 backdrop-blur-sm transition-opacity duration-300 ${
            open ? "opacity-100" : "opacity-0"
          }`}
        />

        {/* painel */}
        <aside
          className={`absolute right-0 top-0 flex h-full w-72 max-w-[82%] flex-col border-l border-edge bg-panel shadow-2xl transition-transform duration-300 ease-out ${
            open ? "translate-x-0" : "translate-x-full"
          }`}
          style={{
            clipPath: "polygon(20px 0, 100% 0, 100% 100%, 0 100%, 0 20px)",
          }}
        >
          {/* cabeçalho do drawer */}
          <div className="flex items-center justify-between border-b border-edge px-4 py-4">
            <span className="plate bg-panel-2 border border-edge px-3 py-1">
              <span className="plate-inner font-title text-base tracking-wide">
                POKE<span className="text-flare">DEX</span>
              </span>
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fechar menu"
              className="clip-btn flex items-center justify-center border border-edge bg-panel-2 p-2 text-ink-dim transition-colors hover:border-bad/60 hover:text-bad"
            >
              <CloseIcon size={18} />
            </button>
          </div>

          {/* usuário */}
          <div className="border-b border-edge px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wider text-ink-dim">Treinador</p>
            <p className="truncate font-title text-lg uppercase tracking-wide">{userName}</p>
          </div>

          {/* links */}
          <nav className="flex flex-1 flex-col gap-1.5 overflow-y-auto p-4">
            <DrawerLink
              href="/"
              label="Início"
              icon={PokeballIcon}
              active={pathname === "/"}
              onNavigate={close}
            />
            {LINKS.map(({ href, label, icon }) => (
              <DrawerLink
                key={href}
                href={href}
                label={label}
                icon={icon}
                active={pathname === href}
                onNavigate={close}
              />
            ))}

            <Link
              href="/battle"
              onClick={close}
              className={`clip-btn mt-2 flex items-center gap-3 px-4 py-3 font-title text-base uppercase tracking-wide text-white transition-colors ${
                battleActive ? "bg-flare-dark" : "bg-flare hover:bg-flare-dark"
              }`}
            >
              <SwordsIcon size={18} />
              <span>Batalhar</span>
            </Link>
          </nav>

          {/* rodapé */}
          <div className="border-t border-edge p-4">
            <SignOutButton />
          </div>
        </aside>
      </div>
    </header>
  );
}

function DrawerLink({
  href,
  label,
  icon: Icon,
  active,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: (props: { size?: number; className?: string }) => React.ReactElement;
  active: boolean;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`clip-btn flex items-center gap-3 border-l-2 px-4 py-3 text-sm font-semibold uppercase tracking-wide transition-colors ${
        active
          ? "border-energy bg-panel-2 text-energy"
          : "border-transparent text-ink-dim hover:bg-panel-2 hover:text-ink"
      }`}
    >
      <Icon size={18} />
      <span>{label}</span>
    </Link>
  );
}
