import { useCallback, useEffect, useRef, useState } from "react";
import { Heart, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

type Thought = {
  id: string;
  sender_id: string;
  seen: boolean;
  created_at: string;
};

type Incoming = Thought & { senderName: string };

function timeAgo(iso: string) {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const s = Math.floor(diff / 1000);
  if (s < 60) return "hace un momentito";
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return `hace ${d} d`;
}

async function fetchName(id: string): Promise<string> {
  const { data } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", id)
    .maybeSingle();
  return data?.display_name ?? "Tu osit@";
}

export function ThinkingOfYou() {
  const { user } = useAuth();
  const [sending, setSending] = useState(false);
  const [burst, setBurst] = useState(0);
  const [totalToday, setTotalToday] = useState(0);
  const [incoming, setIncoming] = useState<Incoming | null>(null);
  const queueRef = useRef<Incoming[]>([]);
  const showingRef = useRef(false);

  const showNext = useCallback(() => {
    if (showingRef.current) return;
    const next = queueRef.current.shift();
    if (!next) return;
    showingRef.current = true;
    setIncoming(next);
  }, []);

  const enqueue = useCallback(
    (t: Incoming) => {
      queueRef.current.push(t);
      showNext();
    },
    [showNext],
  );

  const dismiss = useCallback(async () => {
    const current = incoming;
    setIncoming(null);
    showingRef.current = false;
    if (current) {
      await supabase.from("thoughts").update({ seen: true }).eq("id", current.id);
    }
    setTimeout(showNext, 350);
  }, [incoming, showNext]);

  const loadCount = useCallback(async () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const { count } = await supabase
      .from("thoughts")
      .select("id", { count: "exact", head: true })
      .gte("created_at", start.toISOString());
    setTotalToday(count ?? 0);
  }, []);

  const checkPending = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("thoughts")
      .select("id, sender_id, seen, created_at")
      .eq("seen", false)
      .neq("sender_id", user.id)
      .order("created_at", { ascending: true });
    if (!data?.length) return;
    for (const t of data) {
      const senderName = await fetchName(t.sender_id);
      enqueue({ ...t, senderName });
    }
  }, [user, enqueue]);

  useEffect(() => {
    if (!user) return;
    loadCount();
    checkPending();

    const ch = supabase
      .channel("thoughts:realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "thoughts" },
        async (payload) => {
          const row = payload.new as Thought;
          loadCount();
          if (row.sender_id === user.id) return;
          const senderName = await fetchName(row.sender_id);
          enqueue({ ...row, senderName });
        },
      )
      .subscribe();

    const onFocus = () => checkPending();
    const onVisibility = () => {
      if (document.visibilityState === "visible") checkPending();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      supabase.removeChannel(ch);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [user, loadCount, checkPending, enqueue]);

  const send = async () => {
    if (!user || sending) return;
    setSending(true);
    setBurst((b) => b + 1);
    const { error } = await supabase.from("thoughts").insert({ sender_id: user.id });
    if (error) {
      toast.error("No se pudo enviar 😔");
    } else {
      toast("Enviado 💌", { duration: 2200 });
    }
    setTimeout(() => setSending(false), 700);
  };

  if (!user) return null;

  return (
    <>
      <div className="mt-8 flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={send}
          disabled={sending}
          className={cn(
            "group relative grid h-24 w-24 place-items-center rounded-full text-primary-foreground shadow-soft transition-transform duration-300",
            "active:scale-90",
            sending ? "scale-110" : "hover:scale-105",
          )}
          style={{ backgroundImage: "var(--gradient-romance)" }}
          aria-label="Pensé en ti"
        >
          <Heart
            className={cn(
              "h-10 w-10 fill-current transition-transform",
              sending && "animate-ping-slow",
            )}
          />
          {burst > 0 && (
            <ParticleBurst key={burst} />
          )}
          <span className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-primary/30 opacity-0 group-active:opacity-100 group-active:animate-ping-slow" />
        </button>
        <p className="font-display text-base text-foreground">Pensé en ti 💭</p>
        <p className="text-xs text-muted-foreground">
          {totalToday === 0
            ? "Sé el primero hoy en mandar un abrazo 💕"
            : `Hoy se han pensado ${totalToday} ${totalToday === 1 ? "vez" : "veces"} 💕`}
        </p>
      </div>

      {incoming && (
        <ThoughtOverlay incoming={incoming} onClose={dismiss} />
      )}

      <style>{`
        @keyframes ping-slow { 0% { transform: scale(1); opacity: .9 } 80%,100% { transform: scale(1.6); opacity: 0 } }
        .animate-ping-slow { animation: ping-slow 700ms ease-out; }
        @keyframes thought-in { 0% { opacity: 0; transform: scale(.85) } 100% { opacity: 1; transform: scale(1) } }
        .animate-thought-in { animation: thought-in 500ms cubic-bezier(.2,.9,.3,1.2); }
        @keyframes heart-pulse { 0%,100% { transform: scale(1) } 50% { transform: scale(1.15) } }
        .animate-heart-pulse { animation: heart-pulse 1.4s ease-in-out infinite; }
        @keyframes particle-out {
          0% { opacity: 1; transform: translate(0,0) scale(.6); }
          100% { opacity: 0; transform: var(--tw-translate, translate(0,-40px)) scale(1); }
        }
        .particle { animation: particle-out 700ms ease-out forwards; }
      `}</style>
    </>
  );
}

function ParticleBurst() {
  const particles = Array.from({ length: 8 });
  return (
    <span className="pointer-events-none absolute inset-0">
      {particles.map((_, i) => {
        const angle = (i / particles.length) * Math.PI * 2;
        const dx = Math.cos(angle) * 55;
        const dy = Math.sin(angle) * 55;
        return (
          <span
            key={i}
            className="particle absolute left-1/2 top-1/2 -ml-1.5 -mt-1.5 h-3 w-3 rounded-full"
            style={
              {
                background: i % 2 ? "var(--blush)" : "var(--lavender)",
                ["--tw-translate" as string]: `translate(${dx}px, ${dy}px)`,
              } as React.CSSProperties
            }
          />
        );
      })}
    </span>
  );
}

function ThoughtOverlay({ incoming, onClose }: { incoming: Incoming; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-50 grid place-items-center bg-background/70 px-6 backdrop-blur-md animate-thought-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm rounded-3xl border border-border/60 bg-card/90 p-8 text-center shadow-soft"
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
          {Array.from({ length: 6 }).map((_, i) => (
            <Sparkles
              key={i}
              className="absolute h-4 w-4 text-primary/40 animate-heart-pulse"
              style={{
                top: `${10 + ((i * 37) % 80)}%`,
                left: `${8 + ((i * 53) % 84)}%`,
                animationDelay: `${i * 0.2}s`,
              }}
            />
          ))}
        </div>
        <div
          className="mx-auto grid h-24 w-24 place-items-center rounded-full text-primary-foreground shadow-soft animate-heart-pulse"
          style={{ backgroundImage: "var(--gradient-romance)" }}
        >
          <Heart className="h-12 w-12 fill-current" />
        </div>
        <p className="mt-6 font-display text-2xl text-foreground">
          {incoming.senderName} pensó en ti
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {timeAgo(incoming.created_at)} 💕
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-6 inline-flex items-center gap-2 rounded-full px-6 py-3 text-primary-foreground shadow-soft transition active:scale-95"
          style={{ backgroundImage: "var(--gradient-romance)" }}
        >
          <Heart className="h-4 w-4 fill-current" /> Yo también ❤️
        </button>
      </div>
    </div>
  );
}
