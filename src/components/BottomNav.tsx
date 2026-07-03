import { Link } from "@tanstack/react-router";
import { Heart, Images, MessageCircleHeart, Smile } from "lucide-react";
import { useNotifications } from "@/hooks/use-notifications";

const items = [
  { to: "/", label: "Inicio", Icon: Heart, badge: null },
  { to: "/moods", label: "Ánimo", Icon: Smile, badge: null },
  { to: "/chat", label: "Chat", Icon: MessageCircleHeart, badge: "chat" as const },
  { to: "/gallery", label: "Fotos", Icon: Images, badge: null },
] as const;

export function BottomNav() {
  const { unread } = useNotifications();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/60 bg-card/80 backdrop-blur-lg">
      <ul className="mx-auto flex max-w-md items-stretch justify-around px-2 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-2">
        {items.map(({ to, label, Icon, badge }) => {
          const count = badge ? unread[badge] : 0;
          return (
            <li key={to} className="flex-1">
              <Link
                to={to}
                activeOptions={{ exact: to === "/" }}
                className="flex flex-col items-center gap-0.5 rounded-2xl px-1 py-1 text-[11px] font-medium text-muted-foreground transition-colors"
                activeProps={{ className: "text-primary" }}
              >
                <span className="relative">
                  <Icon className="h-5 w-5" />
                  {count > 0 && (
                    <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold leading-none text-white shadow-sm ring-2 ring-card">
                      {count > 9 ? "9+" : count}
                    </span>
                  )}
                </span>
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
