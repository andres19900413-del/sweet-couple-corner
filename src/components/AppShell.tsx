import type { ReactNode } from "react";
import { BottomNav } from "./BottomNav";
import { MenuDrawer } from "./MenuDrawer";
import { useApplyTheme } from "@/lib/preferences";

export function AppShell({
  children,
  title,
  fitToViewport,
  footer,
}: {
  children: ReactNode;
  title?: string;
  /**
   * Modo especial para pantallas con un campo de texto que el teclado no
   * debe tapar (como el Chat). En vez de usar `position: fixed` (que se
   * porta mal con el teclado en PWAs instaladas en iOS), usa `100dvh` +
   * flexbox normal, que el navegador sí sabe encoger correctamente cuando
   * aparece el teclado.
   */
  fitToViewport?: boolean;
  /** Contenido fijo al fondo (ej. la barra de escribir mensaje) cuando fitToViewport está activo. */
  footer?: ReactNode;
}) {
  useApplyTheme();

  if (fitToViewport) {
    return (
      <div className="mx-auto flex h-[100dvh] max-w-md flex-col overflow-hidden px-5 pt-8">
        <MenuDrawer />
        {title ? (
          <header className="mb-3 shrink-0 pl-14">
            <h1 className="text-3xl font-semibold text-foreground">{title}</h1>
          </header>
        ) : null}
        <main className="-mx-5 min-h-0 flex-1 overflow-y-auto px-5">{children}</main>
        {footer}
        <BottomNav variant="static" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 pb-28 pt-8">
      <MenuDrawer />
      {title ? (
        <header className="mb-6 pl-14">
          <h1 className="text-3xl font-semibold text-foreground">{title}</h1>
        </header>
      ) : null}
      <main className="flex-1">{children}</main>
      <BottomNav />
    </div>
  );
}
