import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PokéArena",
  description: "Capture pokémons, monte seu deck e batalhe contra outros treinadores.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
