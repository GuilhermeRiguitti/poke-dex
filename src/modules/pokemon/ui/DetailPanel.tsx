// A moldura das seções da página de detalhe (stats, movimentos): mesmo painel,
// mesmo título, só muda o conteúdo e o atraso da entrada. Server Component —
// não há nada de interativo aqui.

export default function DetailPanel({
  title,
  hint,
  delayMs,
  children,
}: {
  title: string;
  /** texto secundário ao lado do título (ex: "(105 no total)") */
  hint?: string;
  /** escalona o animate-rise entre os painéis */
  delayMs: number;
  children: React.ReactNode;
}) {
  return (
    <section
      className="clip-card animate-rise border border-edge bg-panel p-6"
      style={{ animationDelay: `${delayMs}ms` } as React.CSSProperties}
    >
      <h2 className="mb-4 font-title text-lg uppercase tracking-wider">
        {title}
        {hint && (
          <span className="ml-2 text-sm font-normal normal-case text-ink-dim">{hint}</span>
        )}
      </h2>
      {children}
    </section>
  );
}
