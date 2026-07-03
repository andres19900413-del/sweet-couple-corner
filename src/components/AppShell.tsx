import type { ReactNode } from "react";
import { BottomNav } from "./BottomNav";
import { MenuDrawer } from "./MenuDrawer";
import { useApplyTheme } from "@/lib/preferences";

export function AppShell({ children, title }: { children: ReactNode; title?: string }) {
  useApplyTheme();
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
