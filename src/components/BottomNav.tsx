import { Link } from "@tanstack/react-router";
import { Heart, ListChecks, NotebookPen, Settings } from "lucide-react";

const items = [
  { to: "/", label: "Inicio", Icon: Heart },
  { to: "/bucket", label: "Planes", Icon: ListChecks },
  { to: "/memories", label: "Recuerdos", Icon: NotebookPen },
  { to: "/settings", label: "Ajustes", Icon: Settings },
] as const;

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/60 bg-card/80 backdrop-blur-lg">
      <ul className="mx-auto flex max-w-md items-stretch justify-around px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
        {items.map(({ to, label, Icon }) => (
          <li key={to} className="flex-1">
            <Link
              to={to}
              activeOptions={{ exact: to === "/" }}
              className="flex flex-col items-center gap-0.5 rounded-2xl px-2 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors"
              activeProps={{ className: "text-primary" }}
            >
              <Icon className="h-5 w-5" />
              <span>{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
