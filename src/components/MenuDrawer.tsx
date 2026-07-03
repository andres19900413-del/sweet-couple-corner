import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  CalendarDays,
  Heart,
  Images,
  ListChecks,
  Menu,
  MessageCircleHeart,
  NotebookPen,
  Settings,
  Smile,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useNotifications } from "@/hooks/use-notifications";

const items = [
  { to: "/", label: "Inicio", Icon: Heart, badge: null },
  { to: "/moods", label: "Ánimo", Icon: Smile, badge: null },
  { to: "/chat", label: "Chat", Icon: MessageCircleHeart, badge: "chat" as const },
  { to: "/gallery", label: "Fotos", Icon: Images, badge: null },
  { to: "/calendar", label: "Fechas", Icon: CalendarDays, badge: null },
  { to: "/bucket", label: "Planes", Icon: ListChecks, badge: null },
  { to: "/memories", label: "Notas", Icon: NotebookPen, badge: "memories" as const },
  { to: "/settings", label: "Ajustes", Icon: Settings, badge: null },
] as const;

export function MenuDrawer() {
  const [open, setOpen] = useState(false);
  const { unread } = useNotifications();
  const totalUnread = (unread.chat ?? 0) + (unread.memories ?? 0);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Abrir menú"
          className="fixed left-4 top-[max(1rem,env(safe-area-inset-top))] z-50 flex h-11 w-11 items-center justify-center rounded-full bg-card/90 text-foreground shadow-lg ring-1 ring-border/60 backdrop-blur-lg transition active:scale-95"
        >
          <Menu className="h-5 w-5" />
          {totalUnread > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold leading-none text-white ring-2 ring-card">
              {totalUnread > 9 ? "9+" : totalUnread}
            </span>
          )}
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="border-b border-border/60 px-6 py-5 text-left">
          <SheetTitle className="text-lg">Menú</SheetTitle>
        </SheetHeader>
        <nav className="p-3">
          <ul className="flex flex-col gap-1">
            {items.map(({ to, label, Icon, badge }) => {
              const count = badge ? unread[badge] : 0;
              return (
                <li key={to}>
                  <Link
                    to={to}
                    activeOptions={{ exact: to === "/" }}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
                    activeProps={{ className: "bg-primary/10 text-primary" }}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="flex-1">{label}</span>
                    {count > 0 && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">
                        {count > 9 ? "9+" : count}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
