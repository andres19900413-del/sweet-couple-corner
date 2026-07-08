import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Gift, Image as ImageIcon, Plus, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/gifts")({
  head: () => ({
    meta: [
      { title: "Regalos digitales 🎁" },
      { name: "description", content: "Cajitas sorpresa que se abren con animación." },
    ],
  }),
  component: GiftsPage,
});

type GiftKind = "photo" | "letter" | "sticker";

type Gift = {
  id: string;
  sender_id: string;
  kind: GiftKind;
  message: string | null;
  image_url: string | null;
  sticker: string | null;
  opened_at: string | null;
  created_at: string;
};

type Profile = { id: string; display_name: string | null };

const STICKERS = ["❤️","💖","💐","🌹","🌸","🧸","🍫","🍰","🎀","✨","🌈","🦋","🥰","😘","💌","🌟"];

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

function GiftsPage() {
  const { user } = useAuth();
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [signed, setSigned] = useState<Record<string, string>>({});
  const [composerOpen, setComposerOpen] = useState(false);
  const [opening, setOpening] = useState<Gift | null>(null);
  const [openStage, setOpenStage] = useState<"shake" | "reveal">("shake");

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("gifts")
      .select("*")
      .order("created_at", { ascending: false });
    if (!data) return;
    const rows = data as Gift[];
    setGifts(rows);

    const ids = Array.from(new Set(rows.map((g) => g.sender_id)));
    if (ids.length) {
      const { data: p } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", ids);
      const map: Record<string, string> = {};
      (p as Profile[] | null)?.forEach((r) => {
        map[r.id] = r.display_name || "Osit@";
      });
      setProfiles(map);
    }

    const paths = rows.map((g) => g.image_url).filter((x): x is string => !!x);
    if (paths.length) {
      const sMap: Record<string, string> = {};
      await Promise.all(
        paths.map(async (path) => {
          const { data: s } = await supabase.storage
            .from("chat-media")
            .createSignedUrl(path, 3600);
          if (s?.signedUrl) sMap[path] = s.signedUrl;
        }),
      );
      setSigned((prev) => ({ ...prev, ...sMap }));
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    load();
    const ch = supabase
      .channel("gifts:rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "gifts" },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, load]);

  const { pending, opened } = useMemo(() => {
    const p: Gift[] = [];
    const o: Gift[] = [];
    for (const g of gifts) {
      const mine = g.sender_id === user?.id;
      if (!g.opened_at && !mine) p.push(g);
      else o.push(g);
    }
    return { pending: p, opened: o };
  }, [gifts, user?.id]);

  const openGift = async (g: Gift) => {
    setOpening(g);
    setOpenStage("shake");
    setTimeout(() => setOpenStage("reveal"), 1400);
    if (!g.opened_at && g.sender_id !== user?.id) {
      await supabase
        .from("gifts")
        .update({ opened_at: new Date().toISOString() })
        .eq("id", g.id);
      load();
    }
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar este regalo?")) return;
    await supabase.from("gifts").delete().eq("id", id);
    load();
  };

  if (!user) return null;

  return (
    <AppShell title="Regalos digitales">
      <p className="mb-5 text-sm text-muted-foreground">
        Envía cajitas sorpresa. Tu osit@ las abrirá con animación. 🎁
      </p>

      <Button onClick={() => setComposerOpen(true)} className="mb-6 w-full gap-2">
        <Plus className="h-4 w-4" /> Enviar un regalito
      </Button>

      {pending.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Para ti ({pending.length})
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {pending.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => openGift(g)}
                className="group relative flex aspect-square flex-col items-center justify-center gap-2 rounded-3xl border border-primary/40 p-4 text-center shadow-soft transition active:scale-95"
                style={{ backgroundImage: "var(--gradient-romance)" }}
              >
                <div className="animate-[wiggle_1.2s_ease-in-out_infinite] text-5xl">🎁</div>
                <p className="text-xs font-medium text-white/95">
                  de {profiles[g.sender_id] ?? "Osit@"}
                </p>
                <span className="absolute right-2 top-2 rounded-full bg-white/25 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
                  ¡Ábreme!
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {opened.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Historial
          </h2>
          <ul className="flex flex-col gap-2">
            {opened.map((g) => {
              const mine = g.sender_id === user.id;
              return (
                <li
                  key={g.id}
                  className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/70 p-3"
                >
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-muted text-lg">
                    {g.kind === "photo" ? "📸" : g.kind === "sticker" ? g.sticker ?? "✨" : "💌"}
                  </div>
                  <button
                    type="button"
                    onClick={() => openGift(g)}
                    className="flex-1 text-left"
                  >
                    <p className="truncate text-sm font-medium text-foreground">
                      {mine ? "Enviado a osit@" : `De ${profiles[g.sender_id] ?? "Osit@"}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {fmt(g.created_at)} · {g.opened_at ? "abierto ✨" : "sin abrir"}
                    </p>
                  </button>
                  {mine && (
                    <button
                      onClick={() => remove(g.id)}
                      className="rounded-full p-1 text-muted-foreground hover:text-destructive"
                      aria-label="Eliminar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {gifts.length === 0 && (
        <div className="rounded-3xl border border-dashed border-border bg-card/40 px-4 py-10 text-center text-sm text-muted-foreground">
          Aún no hay regalos. Envía el primero 🎁💕
        </div>
      )}

      {composerOpen && (
        <Composer
          userId={user.id}
          onClose={() => setComposerOpen(false)}
          onSaved={() => {
            setComposerOpen(false);
            load();
            toast("Regalito enviado 🎁✨");
          }}
        />
      )}

      {opening && (
        <GiftOpener
          gift={opening}
          senderName={profiles[opening.sender_id] ?? "Osit@"}
          imageSrc={opening.image_url ? signed[opening.image_url] ?? null : null}
          stage={openStage}
          onClose={() => setOpening(null)}
        />
      )}

      <style>{`
        @keyframes wiggle {
          0%, 100% { transform: rotate(-6deg) translateY(0); }
          50% { transform: rotate(6deg) translateY(-4px); }
        }
        @keyframes lidPop {
          0% { transform: translateY(0) rotate(0); }
          40% { transform: translateY(-40px) rotate(-12deg); opacity: 1; }
          100% { transform: translateY(-120px) rotate(-30deg); opacity: 0; }
        }
        @keyframes burst {
          0% { transform: scale(0.4); opacity: 0; }
          60% { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </AppShell>
  );
}

function Composer({
  userId,
  onClose,
  onSaved,
}: {
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [kind, setKind] = useState<GiftKind>("letter");
  const [message, setMessage] = useState("");
  const [sticker, setSticker] = useState<string>("❤️");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (kind === "letter" && !message.trim()) {
      toast.error("Escribe un mensaje");
      return;
    }
    if (kind === "photo" && !file) {
      toast.error("Elige una foto");
      return;
    }
    setSaving(true);
    try {
      let image_url: string | null = null;
      if (kind === "photo" && file) {
        const ext = file.name.split(".").pop() ?? "jpg";
        const path = `${userId}/gift-${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("chat-media")
          .upload(path, file, { contentType: file.type });
        if (upErr) throw upErr;
        image_url = path;
      }
      const { error } = await supabase.from("gifts").insert({
        sender_id: userId,
        kind,
        message: message.trim() || null,
        sticker: kind === "sticker" ? sticker : null,
        image_url,
      });
      if (error) throw error;
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo enviar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-end bg-background/70 backdrop-blur-md sm:place-items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl border border-border/60 bg-card p-5 shadow-soft sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <p className="font-display text-lg">Nueva cajita 🎁</p>
          <button onClick={onClose} className="rounded-full p-1 text-muted-foreground" aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-2">
          {(["letter", "photo", "sticker"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={cn(
                "flex flex-col items-center gap-1 rounded-2xl border p-3 text-xs font-medium transition",
                kind === k
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground",
              )}
            >
              <span className="text-2xl">
                {k === "letter" ? "💌" : k === "photo" ? "📸" : "✨"}
              </span>
              {k === "letter" ? "Carta" : k === "photo" ? "Foto" : "Sticker"}
            </button>
          ))}
        </div>

        {kind === "sticker" && (
          <div className="mb-4">
            <p className="mb-2 text-xs text-muted-foreground">Elige un sticker</p>
            <div className="grid grid-cols-8 gap-1.5">
              {STICKERS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSticker(s)}
                  className={cn(
                    "grid h-9 w-9 place-items-center rounded-xl border text-xl transition",
                    sticker === s ? "border-primary bg-primary/15" : "border-border bg-card",
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {kind === "photo" && (
          <label className="mb-4 flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
            <ImageIcon className="h-5 w-5" />
            <span className="flex-1 truncate">
              {file ? file.name : "Elegir foto…"}
            </span>
            <Input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
        )}

        <label className="mb-4 block">
          <span className="mb-1 block text-xs text-muted-foreground">
            Mensaje {kind === "letter" ? "" : "(opcional)"}
          </span>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={kind === "letter" ? 6 : 3}
            placeholder="Escribe algo bonito…"
            maxLength={1000}
          />
        </label>

        <Button onClick={save} disabled={saving} className="w-full gap-2">
          <Gift className="h-4 w-4" />
          {saving ? "Enviando…" : "Envolver y enviar"}
        </Button>
      </div>
    </div>
  );
}

function GiftOpener({
  gift,
  senderName,
  imageSrc,
  stage,
  onClose,
}: {
  gift: Gift;
  senderName: string;
  imageSrc: string | null;
  stage: "shake" | "reveal";
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-background/85 px-4 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-3xl border border-border/60 bg-card p-6 shadow-soft"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground"
          aria-label="Cerrar"
        >
          <X className="h-5 w-5" />
        </button>

        {stage === "shake" ? (
          <div className="flex flex-col items-center py-10">
            <div className="relative">
              <div
                className="text-8xl"
                style={{ animation: "wiggle 0.5s ease-in-out infinite" }}
              >
                🎁
              </div>
              <div
                className="absolute left-1/2 top-0 -translate-x-1/2 text-5xl"
                style={{ animation: "lidPop 1.4s ease-out forwards" }}
              >
                🎀
              </div>
            </div>
            <p className="mt-6 text-sm text-muted-foreground">
              Un regalito de <span className="font-medium text-foreground">{senderName}</span>…
            </p>
          </div>
        ) : (
          <div
            className="flex flex-col items-center py-4"
            style={{ animation: "burst 0.6s ease-out" }}
          >
            <div className="mb-2 flex items-center gap-2 text-primary">
              <Sparkles className="h-4 w-4" />
              <p className="text-xs uppercase tracking-widest">Abierto</p>
            </div>

            {gift.kind === "photo" && imageSrc && (
              <img
                src={imageSrc}
                alt="Regalo"
                className="mb-4 max-h-72 w-full rounded-2xl object-cover shadow-soft"
              />
            )}

            {gift.kind === "sticker" && (
              <div className="my-4 text-8xl" style={{ animation: "burst 0.8s ease-out" }}>
                {gift.sticker ?? "✨"}
              </div>
            )}

            {gift.message && (
              <p className="whitespace-pre-wrap text-center text-base leading-relaxed text-foreground">
                {gift.message}
              </p>
            )}

            <p className="mt-4 text-xs text-muted-foreground">
              Con cariño, de {senderName} 💕
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
