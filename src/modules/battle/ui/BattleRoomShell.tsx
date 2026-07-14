// Moldura full-bleed da sala: preenche a viewport abaixo da navbar (h-16),
// largura total até 1920px.
//
// Sem "use client" de propósito — quem renderiza isso é a page (servidor), e
// a sala entra como children. Assim o HTML da moldura já sai pronto do
// servidor, e o canvas do Konva não remonta a cada render da sala.
export default function BattleRoomShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 top-16 bg-bg">
      <div className="mx-auto h-full max-w-480">{children}</div>
    </div>
  );
}
