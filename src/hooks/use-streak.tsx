import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export type StreakInfo = {
  current: number;
  longest: number;
  lastVisit: string | null;
};

export function useStreak() {
  const { user } = useAuth();
  const [streak, setStreak] = useState<StreakInfo>({ current: 0, longest: 0, lastVisit: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc("touch_streak");
      if (cancelled) return;
      if (!error && data && data.length > 0) {
        const row = data[0];
        setStreak({
          current: row.current_streak ?? 0,
          longest: row.longest_streak ?? 0,
          lastVisit: row.last_visit_date ?? null,
        });
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return { streak, loading };
}
