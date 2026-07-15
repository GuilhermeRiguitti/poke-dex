// Arte própria em SVG — nenhum asset externo.

export function PokeballIcon({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      aria-hidden="true"
    >
      <circle cx="50" cy="50" r="46" fill="#ee4035" stroke="#0b1020" strokeWidth="6" />
      <path d="M4 50 a46 46 0 0 0 92 0 Z" fill="#f4f6fb" />
      <rect x="4" y="45" width="92" height="10" fill="#0b1020" />
      <circle cx="50" cy="50" r="15" fill="#f4f6fb" stroke="#0b1020" strokeWidth="6" />
      <circle cx="50" cy="50" r="6" fill="#dfe5f1" />
    </svg>
  );
}

export function SwordsIcon({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 3l7 7" />
      <path d="M13 13l4 4" />
      <path d="M14.5 6.5L18 3h3v3l-3.5 3.5" />
      <path d="M6.5 14.5L3 18v3h3l3.5-3.5" />
      <path d="M21 3L10 14" />
      <path d="M16 16l4 4" />
      <path d="M4 20l4-4" />
    </svg>
  );
}

export function MenuIcon({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M3 12h18" />
      <path d="M3 18h18" />
    </svg>
  );
}

export function CloseIcon({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M5 5l14 14" />
      <path d="M19 5L5 19" />
    </svg>
  );
}

export function PackIcon({ size = 20, className = "" }: { size?: number; className?: string }) {
  // Um pacote/caixa de cartas com laço — a ação central do jogo.
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 8h16v12H4z" />
      <path d="M2 8h20v3H2z" />
      <path d="M12 8v12" />
      <path d="M12 8S9.5 4 7.5 4 5 7 7 8" />
      <path d="M12 8s2.5-4 4.5-4 2 3 0 4" />
    </svg>
  );
}

export function GridIcon({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

export function CardsIcon({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="5" width="12" height="16" rx="2" />
      <path d="M17 3.5l3.5 1a2 2 0 0 1 1.4 2.4L19 19" />
    </svg>
  );
}
