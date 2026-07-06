import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export type Profile = {
  id: string;
  display_name: string | null;
  avatar_emoji: string | null;
  avatar_url: string | null;
  banner_url: string | null;
};

async function signUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  const { data } = await supabase.storage.from("profiles").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

export function useProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);
  const [bannerSrc, setBannerSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setAvatarSrc(null);
      setBannerSrc(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_emoji, avatar_url, banner_url")
      .eq("id", user.id)
      .maybeSingle();
    setProfile(data ?? null);
    const [a, b] = await Promise.all([signUrl(data?.avatar_url ?? null), signUrl(data?.banner_url ?? null)]);
    setAvatarSrc(a);
    setBannerSrc(b);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  return { profile, avatarSrc, bannerSrc, loading, reload: load };
}
