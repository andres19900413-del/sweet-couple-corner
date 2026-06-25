import { createFileRoute } from "@tanstack/react-router";
import { Image as ImageIcon, Send, Smile, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/chat")({
  head: () => ({ meta: [{ title: "Chat 💌" }] }),
  component: ChatPage,
});

type Msg = {
  id: string;
  sender_id: string;
  content: string | null;
  image_url: string | null;
  sticker: string | null;
  created_at: string;
};

const STICKERS = [
  "❤️", "💖", "💕", "💘", "💝", "💞",
  "😘", "🥰", "😍", "🤗", "🥺", "😻",
  "🌹", "🌸", "🌷", "🌻", "✨", "🌟",
  "🧸", "🎀", "🍓", "🍰", "🧁", "☕",
  "💌", "💐", "🌈", "🌙", "🦋", "🐻",
];

function ChatPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    supabase
      .from("messages")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(500)
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) toast.error(error.message);
        else setMessages(data as Msg[]);
      });

    const channel = supabase
      .channel("messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => setMessages((m) => [...m, payload.new as Msg]),
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "messages" },
        (payload) =>
          setMessages((m) => m.filter((x) => x.id !== (payload.old as Msg).id)),
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  // Resolve signed URLs for images
  useEffect(() => {
    const need = messages
      .filter((m) => m.image_url && !urls[m.image_url])
      .map((m) => m.image_url!) as string[];
    if (need.length === 0) return;
    Promise.all(
      need.map(async (path) => {
        const { data } = await supabase.storage
          .from("chat-media")
          .createSignedUrl(path, 3600);
        return [path, data?.signedUrl ?? ""] as const;
      }),
    ).then((entries) => {
      setUrls((prev) => {
        const next = { ...prev };
        for (const [p, u] of entries) next[p] = u;
        return next;
      });
    });
  }, [messages, urls]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (payload: Partial<Msg>) => {
    if (!user) return;
    const { error } = await supabase.from("messages").insert({
      sender_id: user.id,
      content: payload.content ?? null,
      image_url: payload.image_url ?? null,
      sticker: payload.sticker ?? null,
    });
    if (error) toast.error(error.message);
  };

  const onSend = async () => {
    const t = text.trim();
    if (!t) return;
    setText("");
    await send({ content: t });
  };

  const onSticker = (s: string) => send({ sticker: s });

  const onPickFile = async (file: File) => {
    if (!user) return;
    setBusy(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("chat-media")
        .upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;
      await send({ image_url: path });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error subiendo foto");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("messages").delete().eq("id", id);
    if (error) toast.error(error.message);
  };

  return (
    <AppShell title="Chat">
      <div className="flex flex-col gap-2 pb-32">
        {messages.length === 0 && (
          <p className="rounded-2xl border border-dashed border-border bg-card/40 px-4 py-8 text-center text-sm text-muted-foreground">
            Aún no hay mensajes. Mándale algo bonito 💕
          </p>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === user?.id;
          return (
            <div
              key={m.id}
              className={`flex ${mine ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`group relative max-w-[78%] rounded-2xl px-3 py-2 shadow-soft ${
                  mine
                    ? "rounded-br-sm bg-primary text-primary-foreground"
                    : "rounded-bl-sm bg-card/90 text-foreground"
                }`}
              >
                {m.sticker && (
                  <div className="text-5xl leading-none">{m.sticker}</div>
                )}
                {m.image_url && (
                  <img
                    src={urls[m.image_url] ?? ""}
                    alt="foto"
                    className="max-h-64 rounded-xl object-cover"
                  />
                )}
                {m.content && (
                  <p className="whitespace-pre-wrap break-words text-sm">
                    {m.content}
                  </p>
                )}
                <div
                  className={`mt-1 text-[10px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}
                >
                  {new Date(m.created_at).toLocaleTimeString("es-ES", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
                {mine && (
                  <button
                    onClick={() => remove(m.id)}
                    aria-label="Borrar"
                    className="absolute -left-7 top-1/2 hidden -translate-y-1/2 text-muted-foreground hover:text-destructive group-hover:block"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <div className="fixed bottom-16 left-0 right-0 z-30 border-t border-border/60 bg-card/90 backdrop-blur-lg">
        <div className="mx-auto flex max-w-md items-center gap-2 px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <Popover>
            <PopoverTrigger asChild>
              <Button size="icon" variant="ghost" aria-label="Stickers">
                <Smile className="h-5 w-5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-72 p-2 pointer-events-auto"
              align="start"
              side="top"
            >
              <div className="grid grid-cols-6 gap-1">
                {STICKERS.map((s) => (
                  <button
                    key={s}
                    onClick={() => onSticker(s)}
                    className="rounded-lg p-2 text-2xl transition hover:bg-accent"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            aria-label="Foto"
          >
            <ImageIcon className="h-5 w-5" />
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onPickFile(e.target.files[0])}
          />
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSend()}
            placeholder="Escríbele algo bonito…"
            className="flex-1"
          />
          <Button size="icon" onClick={onSend} disabled={!text.trim()} aria-label="Enviar">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
