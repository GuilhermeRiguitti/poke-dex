// Moldura full-bleed da sala: preenche a viewport inteira abaixo da navbar
// (h-16). Sem max-width de propósito — o palco 3D é o CENÁRIO da tela toda, e
// travar a largura deixaria tarja preta nos monitores largos.
//
// Sem "use client" de propósito — quem renderiza isso é a page (servidor), e
// a sala entra como children. Assim o HTML da moldura já sai pronto do
// servidor, e o canvas não remonta a cada render da sala.
export default function BattleRoomShell({ children }: { children: React.ReactNode }) {
  return <div className="fixed inset-x-0 bottom-0 top-16 overflow-hidden bg-bg">{children}</div>;
}
