import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PokéDex",
  description: "Uma Pokédex feita com Next.js",
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
