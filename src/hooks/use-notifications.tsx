import { useRouterState } from "@tanstack/react-router";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

type Channel = "chat" | "memories";

type NotificationsContextValue = {
  unread: Record<Channel, number>;
  markRead: (c: Channel) => void;
};

const NotificationsContext = createContext<NotificationsContextValue>({
  unread: { chat: 0, memories: 0 },
  markRead: () => {},
});

const ROUTE_FOR: Record<Channel, string> = {
  chat: "/chat",
  memories: "/memories",
};

function playChime() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    const now = ctx.currentTime;
    const notes = [880, 1175]; // A5 → D6, dulce
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = now + i * 0.14;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.18, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.4);
    });
    setTimeout(() => ctx.close().catch(() => {}), 900);
  } catch {
    /* sound is best-effort */
  }
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const pathRef = useRef(pathname);
  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);

  const [unread, setUnread] = useState<Record<Channel, number>>({ chat: 0, memories: 0 });

  const markRead = useCallback((c: Channel) => {
    setUnread((u) => (u[c] === 0 ? u : { ...u, [c]: 0 }));
  }, []);

  // Auto-clear when navigating into the channel
  useEffect(() => {
    if (pathname === ROUTE_FOR.chat) markRead("chat");
    if (pathname === ROUTE_FOR.memories) markRead("memories");
  }, [pathname, markRead]);

  useEffect(() => {
    if (!user) return;

    const handle = (channel: Channel, senderId: string, toastMsg: string) => {
      if (senderId === user.id) return;
      const onRoute = pathRef.current === ROUTE_FOR[channel];
      if (onRoute) return;
      setUnread((u) => ({ ...u, [channel]: u[channel] + 1 }));
      playChime();
      toast(toastMsg, { duration: 4500 });
    };

    const ch = supabase
      .channel("notif:global")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const row = payload.new as { sender_id: string };
          handle("chat", row.sender_id, "💌 Nuevo mensaje en el chat");
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notes" },
        (payload) => {
          const row = payload.new as { author_id: string };
          handle("memories", row.author_id, "🧸 ¡Tu osita te ha dejado una nota!");
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [user]);

  const value = useMemo(() => ({ unread, markRead }), [unread, markRead]);
  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  return useContext(NotificationsContext);
}
