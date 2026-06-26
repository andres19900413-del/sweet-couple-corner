import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { usePreferences } from "@/lib/preferences";

export const Route = createFileRoute("/moods")({
  component: MoodsPage,
});

type MoodRow = { user_id: string; mood_value: number; updated_at: string };

function moodEmoji(v: number) {
  if (v < 15) return "😭";
  if (v < 35) return "😢";
  if (v < 50) return "😕";
  if (v < 65) return "😌";
  if (v < 85) return "😊";
  return "🥰";
}

function bearFace(v: number, kind: "him" | "her") {
  // Cute bear with mood-based mouth
  const bg = kind === "him" ? "#c9a37a" : "#f4c2cc";
  const inner = kind === "him" ? "#e8c9a8" : "#fde0e6";
  const bow = kind === "her";
  const mouthD =
    v < 30
      ? "M30 56 Q40 48 50 56" // sad (frown)
      : v < 60
        ? "M30 54 L50 54" // neutral
        : "M30 50 Q40 62 50 50"; // smile
  const eyeY = v > 70 ? 38 : 40;
  return (
    <svg viewBox="0 0 80 80" className="h-32 w-32 drop-shadow-md">
      {/* ears */}
      <circle cx="18" cy="18" r="10" fill={bg} />
      <circle cx="62" cy="18" r="10" fill={bg} />
      <circle cx="18" cy="18" r="5" fill={inner} />
      <circle cx="62" cy="18" r="5" fill={inner} />
      {/* head */}
      <circle cx="40" cy="42" r="28" fill={bg} />
      {/* snout */}
      <ellipse cx="40" cy="52" rx="14" ry="10" fill={inner} />
      {/* nose */}
      <ellipse cx="40" cy="46" rx="3" ry="2" fill="#3b2a22" />
      {/* eyes */}
      <circle cx="30" cy={eyeY} r="2.4" fill="#3b2a22" />
      <circle cx="50" cy={eyeY} r="2.4" fill="#3b2a22" />
      {/* blush */}
      <circle cx="22" cy="50" r="3" fill="#f7a8b8" opacity="0.7" />
      <circle cx="58" cy="50" r="3" fill="#f7a8b8" opacity="0.7" />
      {/* mouth */}
      <path d={mouthD} stroke="#3b2a22" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      {/* bow for her */}
      {bow && (
        <g>
          <path d="M12 12 L20 6 L20 18 Z" fill="#e94f6e" />
          <path d="M28 12 L20 6 L20 18 Z" fill="#e94f6e" />
          <circle cx="20" cy="12" r="2" fill="#c93a55" />
        </g>
      )}
    </svg>
  );
}

function MoodCard({
  name,
  kind,
  value,
  editable,
  onChange,
}: {
  name: string;
  kind: "him" | "her";
  value: number;
  editable: boolean;
  onChange?: (v: number) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border border-border/60 bg-card/70 p-4 shadow-sm backdrop-blur">
      <div className="relative">
        {bearFace(value, kind)}
        <div className="absolute -bottom-1 -right-1 rounded-full bg-background px-2 py-0.5 text-xl shadow">
          {moodEmoji(value)}
        </div>
      </div>
      <div className="text-center">
        <p className="font-serif text-lg font-semibold text-foreground">{name}</p>
        <p className="text-xs text-muted-foreground">
          {editable ? "Mueve tu barra" : "Cómo se siente"}
        </p>
      </div>
      <div className="w-full px-1">
        <Slider
          value={[value]}
          min={0}
          max={100}
          step={1}
          disabled={!editable}
          onValueChange={(v) => onChange?.(v[0] ?? 0)}
        />
        <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
          <span>Triste 😢</span>
          <span className="font-medium text-foreground">{value}%</span>
          <span>Feliz 🥰</span>
        </div>
      </div>
    </div>
  );
}

function MoodsPage() {
  const { user } = useAuth();
  const { prefs } = usePreferences();
  const [moods, setMoods] = useState<Record<string, MoodRow>>({});
  const [loading, setLoading] = useState(true);

  const myId = user?.id;
  const myMood = myId ? (moods[myId]?.mood_value ?? 50) : 50;
  const partnerRow = Object.values(moods).find((m) => m.user_id !== myId);
  const partnerMood = partnerRow?.mood_value ?? 50;

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.from("moods").select("*");
      if (!active) return;
      const map: Record<string, MoodRow> = {};
      (data ?? []).forEach((r) => (map[r.user_id] = r as MoodRow));
      setMoods(map);
      setLoading(false);
    })();
    const channel = supabase
      .channel("moods-room")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "moods" },
        (payload) => {
          const row = (payload.new ?? payload.old) as MoodRow | undefined;
          if (!row) return;
          if (payload.eventType === "DELETE") {
            setMoods((m) => {
              const { [row.user_id]: _, ...rest } = m;
              return rest;
            });
          } else {
            setMoods((m) => ({ ...m, [row.user_id]: row }));
          }
        },
      )
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const updateMyMood = async (v: number) => {
    if (!myId) return;
    setMoods((m) => ({
      ...m,
      [myId]: { user_id: myId, mood_value: v, updated_at: new Date().toISOString() },
    }));
    await supabase.from("moods").upsert({ user_id: myId, mood_value: v });
  };

  const myName = prefs.myName?.trim() || "Yo";
  const partnerName = prefs.partnerName?.trim() || "Mi amor";

  return (
    <AppShell title="Nuestro estado de ánimo 💞">
      <p className="mb-5 text-sm text-muted-foreground">
        Cuéntale al otro cómo te sientes hoy. Solo tú mueves tu barra ✨
      </p>
      {loading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">Cargando...</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <MoodCard
            name={myName}
            kind="him"
            value={myMood}
            editable
            onChange={updateMyMood}
          />
          <MoodCard
            name={partnerName}
            kind="her"
            value={partnerMood}
            editable={false}
          />
        </div>
      )}
      <p className="mt-6 text-center text-xs text-muted-foreground">
        Se actualiza en tiempo real 💌
      </p>
    </AppShell>
  );
}
