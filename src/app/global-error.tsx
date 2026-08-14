"use client";

// Último recurso: pega o que quebra no PRÓPRIO root layout (fonte que não
// carregou, provider que lançou) — o `error.tsx` de (game) não alcança isso,
// porque ele vive DENTRO do layout que falhou.
//
// Por isso este arquivo renderiza <html> e <body> próprios: quando ele aparece,
// o root layout não existe na árvore, e com ele foram embora as variáveis de
// fonte e o globals.css. As cores vão literais de propósito — não há token
// carregado pra referenciar.

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="pt-BR">
      <body
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          margin: 0,
          background: "#0b0f16",
          color: "#edf2fb",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
        }}
      >
        <h1 style={{ fontSize: "1.75rem", color: "#ff5c5c", margin: 0 }}>
          A aplicação não conseguiu carregar
        </h1>
        <p style={{ color: "#8da0bf", margin: 0 }}>
          Recarregue a página. Se continuar, tente de novo em alguns minutos.
        </p>
        {error.digest ? (
          <p style={{ color: "#8da0bf", fontSize: "0.75rem", margin: 0 }}>
            código: {error.digest}
          </p>
        ) : null}
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: "0.5rem",
            padding: "0.5rem 1.5rem",
            borderRadius: "0.5rem",
            border: "none",
            background: "#ff9c1a",
            color: "#0b0f16",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Tentar de novo
        </button>
      </body>
    </html>
  );
}
