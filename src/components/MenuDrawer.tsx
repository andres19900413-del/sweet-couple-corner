import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  CalendarDays,
  Heart,
  Images,
  ListChecks,
  Mail,
  Menu,
  MessageCircleHeart,
  NotebookPen,
  Settings,
  Smile,
  ChevronRight,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useNotifications } from "@/hooks/use-notifications";
import { useProfile } from "@/hooks/use-profile";

const items = [
  { to: "/", label: "Inicio", Icon: Heart, badge: null },
  { to: "/moods", label: "Ánimo", Icon: Smile, badge: null },
  { to: "/chat", label: "Chat", Icon: MessageCircleHeart, badge: "chat" as const },
  { to: "/gallery", label: "Fotos", Icon: Images, badge: null },
  { to: "/calendar", label: "Fechas", Icon: CalendarDays, badge: null },
  { to: "/bucket", label: "Planes", Icon: ListChecks, badge: null },
  { to: "/letters", label: "Cartas", Icon: Mail, badge: null },
  { to: "/memories", label: "Notas", Icon: NotebookPen, badge: "memories" as const },
  { to: "/settings", label: "Ajustes", Icon: Settings, badge: null },
] as const;


export function MenuDrawer() {
  const [open, setOpen] = useState(false);
  const { unread } = useNotifications();
  const { profile, avatarSrc, bannerSrc } = useProfile();
  const totalUnread = (unread.chat ?? 0) + (unread.memories ?? 0);
  const name = profile?.display_name || "Mi perfil";

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
      <SheetContent side="left" className="w-72 overflow-y-auto p-0">
        <SheetHeader className="sr-only">
          <SheetTitle>Menú</SheetTitle>
        </SheetHeader>

        <Link
          to="/profile"
          onClick={() => setOpen(false)}
          className="group block"
          aria-label="Ir a mi perfil"
        >
          <div
            className="relative h-44 w-full bg-gradient-to-br from-primary/50 to-accent/50 bg-cover bg-center"
            style={bannerSrc ? { backgroundImage: `url(${bannerSrc})` } : undefined}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
            <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur">
              Editar <ChevronRight className="h-3 w-3" />
            </span>
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <div className="h-20 w-20 overflow-hidden rounded-full border-4 border-card bg-muted shadow-lg">
                {avatarSrc ? (
                  <img src={avatarSrc} alt={name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-2xl">
                    {profile?.avatar_emoji || "🧸"}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-col items-center px-4 pb-4 pt-3">
            <p className="font-display text-base text-foreground group-hover:text-primary">
              {name}
            </p>
            <p className="text-[11px] text-muted-foreground">Ver mi perfil</p>
          </div>
        </Link>


        <nav className="border-t border-border/60 p-3">
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
