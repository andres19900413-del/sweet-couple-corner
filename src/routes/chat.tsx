import { createFileRoute } from "@tanstack/react-router";
import { Image as ImageIcon, Mic, MicOff, Phone, Reply, Send, Smile, Timer, Trash2, Video, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/image-compress";

export const Route = createFileRoute("/chat")({
  head: () => ({ meta: [{ title: "Chat 💌" }] }),
  component: ChatPage,
});

type Msg = {
  id: string;
  sender_id: string;
  content: string | null;
  image_url: string | null;
  audio_url: string | null;
  sticker: string | null;
  type: string | null;
  expires_at: string | null;
  reactions: Record<string, string[]> | null;
  reply_to_id: string | null;
  created_at: string;
};

const STICKERS = [
  "❤️","💖","💕","💘","💝","💞","😘","🥰","😍","🤗","🥺","😻",
  "🌹","🌸","🌷","🌻","✨","🌟","🧸","🎀","🍓","🍰","🧁","☕",
  "💌","💐","🌈","🌙","🦋","🐻",
];

const REACTION_EMOJIS = ["❤️","😂","😮","😢","🔥","👍"];

const SELF_DESTRUCT_OPTIONS = [
  { label: "5 seg", seconds: 5 },
  { label: "1 min", seconds: 60 },
  { label: "1 hora", seconds: 3600 },
  { label: "24 horas", seconds: 86400 },
];

function formatAudioTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function AudioPlayer({ src }: { src: string }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) audioRef.current.pause();
    else audioRef.current.play();
    setPlaying(!playing);
  };

  return (
    <div className="flex items-center gap-2 min-w-[160px]">
      <audio
        ref={audioRef}
        src={src}
        onLoadedMetadata={(e) => setDuration((e.target as HTMLAudioElement).duration)}
        onTimeUpdate={(e) => {
          const el = e.target as HTMLAudioElement;
          setProgress((el.currentTime / el.duration) * 100 || 0);
        }}
        onEnded={() => { setPlaying(false); setProgress(0); }}
      />
      <button onClick={toggle} className="text-xl">{playing ? "⏸" : "▶️"}</button>
      <div className="flex-1 h-1.5 bg-white/30 rounded-full overflow-hidden">
        <div className="h-full bg-white/80 rounded-full transition-all" style={{ width: `${progress}%` }} />
      </div>
      <span className="text-[10px] opacity-70">{formatAudioTime(duration)}</span>
    </div>
  );
}

function messagePreview(m: Msg | undefined): string {
  if (!m) return "Mensaje";
  if (m.content) return m.content;
  if (m.sticker) return m.sticker;
  if (m.image_url) return "📸 Foto";
  if (m.audio_url) return "🎙 Audio";
  return "Mensaje";
}

function ChatPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [imgUrls, setImgUrls] = useState<Record<string, string>>({});
  const [audioUrls, setAudioUrls] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  const [selfDestruct, setSelfDestruct] = useState<number | null>(null);
  const [showDestructMenu, setShowDestructMenu] = useState(false);
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const msgRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const recordTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isActuallyRecording = useRef(false);

  const msgById = useMemo(() => {
    const map: Record<string, Msg> = {};
    for (const m of messages) map[m.id] = m;
    return map;
  }, [messages]);

  const cleanExpired = useCallback(() => {
    setMessages(prev => prev.filter(m => {
      if (!m.expires_at) return true;
      return new Date(m.expires_at) > new Date();
    }));
  }, []);

  useEffect(() => {
    const interval = setInterval(cleanExpired, 5000);
    return () => clearInterval(interval);
  }, [cleanExpired]);

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
        else setMessages((data as Msg[]).filter(m => !m.expires_at || new Date(m.expires_at) > new Date()));
      });

    const channel = supabase
      .channel("messages-v2")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" },
        (payload) => setMessages((m) => [...m, payload.new as Msg]))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" },
        (payload) => setMessages((m) => m.map(x => x.id === (payload.new as Msg).id ? payload.new as Msg : x)))
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages" },
        (payload) => setMessages((m) => m.filter((x) => x.id !== (payload.old as Msg).id)))
      .subscribe();

    return () => { mounted = false; supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    const need = messages.filter((m) => m.image_url && !imgUrls[m.image_url]).map((m) => m.image_url!) as string[];
    if (!need.length) return;
    Promise.all(need.map(async (path) => {
      const { data } = await supabase.storage.from("chat-media").createSignedUrl(path, 3600);
      return [path, data?.signedUrl ?? ""] as const;
    })).then((entries) => setImgUrls(prev => { const next = { ...prev }; for (const [p, u] of entries) next[p] = u; return next; }));
  }, [messages, imgUrls]);

  useEffect(() => {
    const need = messages.filter((m) => m.audio_url && !audioUrls[m.audio_url]).map((m) => m.audio_url!) as string[];
    if (!need.length) return;
    Promise.all(need.map(async (path) => {
      const { data } = await supabase.storage.from("chat-media").createSignedUrl(path, 3600);
      return [path, data?.signedUrl ?? ""] as const;
    })).then((entries) => setAudioUrls(prev => { const next = { ...prev }; for (const [p, u] of entries) next[p] = u; return next; }));
  }, [messages, audioUrls]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async (payload: Partial<Msg>) => {
    if (!user) return;
    const expires_at = selfDestruct ? new Date(Date.now() + selfDestruct * 1000).toISOString() : null;
    const { error } = await supabase.from("messages").insert({
      sender_id: user.id,
      content: payload.content ?? null,
      image_url: payload.image_url ?? null,
      audio_url: payload.audio_url ?? null,
      sticker: payload.sticker ?? null,
      type: payload.type ?? "text",
      expires_at,
      reactions: {},
      reply_to_id: replyTo?.id ?? null,
    });
    if (error) toast.error(error.message);
    setSelfDestruct(null);
    setReplyTo(null);
  };

  const onSend = async () => {
    const t = text.trim();
    if (!t) return;
    setText("");
    await send({ content: t, type: "text" });
  };

  const onSticker = (s: string) => send({ sticker: s, type: "sticker" });

  const onPickFile = async (file: File) => {
    if (!user) return;
    setBusy(true);
    try {
      const compressed = await compressImage(file);
      const ext = compressed.name.split(".").pop() ?? "jpg";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("chat-media").upload(path, compressed, { contentType: compressed.type });
      if (upErr) throw upErr;
      await send({ image_url: path, type: "image" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error subiendo foto");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  // Antes, la grabación arrancaba apenas se tocaba el botón (onPointerDown),
  // así que cualquier toque rápido o accidental (muy común en móvil, por
  // ejemplo justo cuando el teclado se está cerrando) disparaba el
  // micrófono y terminaba en el error "No se pudo acceder al micrófono"
  // en vez de simplemente no hacer nada. Ahora esperamos ~180ms de
  // pulsación sostenida antes de considerar que es una grabación real.
  const PRESS_THRESHOLD_MS = 180;

  const beginPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = setTimeout(async () => {
      pressTimer.current = null;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mr = new MediaRecorder(stream);
        audioChunks.current = [];
        mr.ondataavailable = (e) => audioChunks.current.push(e.data);
        mr.onstop = async () => {
          stream.getTracks().forEach((t) => t.stop());
          const blob = new Blob(audioChunks.current, { type: "audio/webm" });
          setBusy(true);
          try {
            const path = `${user!.id}/audio-${crypto.randomUUID()}.webm`;
            const { error } = await supabase.storage.from("chat-media").upload(path, blob, { contentType: "audio/webm" });
            if (error) throw error;
            await send({ audio_url: path, type: "audio" });
          } catch {
            toast.error("Error enviando audio");
          } finally {
            setBusy(false);
          }
        };
        mr.start();
        mediaRecorder.current = mr;
        isActuallyRecording.current = true;
        setRecording(true);
        setRecordSecs(0);
        recordTimer.current = setInterval(() => setRecordSecs((s) => s + 1), 1000);
      } catch {
        toast.error("No se pudo acceder al micrófono");
      }
    }, PRESS_THRESHOLD_MS);
  };

  const endPress = () => {
    // Si soltó antes de que se cumpliera el umbral, fue un toque rápido
    // (probablemente sin intención de grabar) — simplemente lo ignoramos,
    // sin mostrar ningún error ni pedir permiso de micrófono.
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
      return;
    }
    if (!isActuallyRecording.current) return;
    isActuallyRecording.current = false;
    mediaRecorder.current?.stop();
    setRecording(false);
    if (recordTimer.current) clearInterval(recordTimer.current);
  };

  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const toggleReaction = async (msgId: string, emoji: string, currentReactions: Record<string, string[]> | null) => {
    if (!user) return;
    const reactions = { ...(currentReactions ?? {}) };
    const users = reactions[emoji] ?? [];
    if (users.includes(user.id)) {
      reactions[emoji] = users.filter(u => u !== user.id);
      if (!reactions[emoji].length) delete reactions[emoji];
    } else {
      reactions[emoji] = [...users, user.id];
    }
    setPickerFor(null);
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, reactions } : m));
    const { error } = await supabase.from("messages").update({ reactions }).eq("id", msgId);
    if (error) toast.error("No se pudo reaccionar 😔");
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("messages").delete().eq("id", id);
    if (error) toast.error(error.message);
  };

  const startReply = (m: Msg) => {
    setReplyTo(m);
    setPickerFor(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const scrollToMsg = (id: string) => {
    const el = msgRefs.current[id];
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightId(id);
    setTimeout(() => setHighlightId(null), 1500);
  };

  const startCall = (video: boolean) => {
    const roomName = `amor-${[user?.id].sort().join("-")}`;
    const url = `https://whereby.com/${roomName}?${video ? "" : "skipMediaPermissionPrompt&audioOnly=1"}`;
    window.open(url, "_blank");
    toast.success(video ? "📹 Videollamada iniciada — comparte el link con tu pareja" : "📞 Llamada iniciada");
  };

  return (
    <AppShell title="Chat">
      <div className="flex gap-2 mb-3 px-1">
        <Button size="sm" variant="outline" onClick={() => startCall(false)} className="flex-1 gap-1.5 text-xs">
          <Phone className="h-3.5 w-3.5" /> Llamada de voz
        </Button>
        <Button size="sm" variant="outline" onClick={() => startCall(true)} className="flex-1 gap-1.5 text-xs">
          <Video className="h-3.5 w-3.5" /> Videollamada
        </Button>
      </div>

      <div className="flex flex-col gap-2 pb-32">
        {messages.length === 0 && (
          <p className="rounded-2xl border border-dashed border-border bg-card/40 px-4 py-8 text-center text-sm text-muted-foreground">
            Aún no hay mensajes. Mándale algo bonito 💕
          </p>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === user?.id;
          const allReactions = m.reactions ?? {};
          const hasReactions = Object.keys(allReactions).some(k => allReactions[k].length > 0);
          const expiresIn = m.expires_at ? Math.max(0, Math.floor((new Date(m.expires_at).getTime() - Date.now()) / 1000)) : null;
          const parent = m.reply_to_id ? msgById[m.reply_to_id] : undefined;

          return (
            <div key={m.id} ref={(el) => { msgRefs.current[m.id] = el; }} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
              <div
                onDoubleClick={() => setPickerFor(pickerFor === m.id ? null : m.id)}
                onContextMenu={(e) => { e.preventDefault(); setPickerFor(pickerFor === m.id ? null : m.id); }}
                className={`group relative max-w-[78%] rounded-2xl px-3 py-2 shadow-soft transition-all ${mine ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-card/90 text-foreground"} ${highlightId === m.id ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`}
              >
                {parent && (
                  <button
                    type="button"
                    onClick={() => scrollToMsg(parent.id)}
                    className={`mb-1.5 flex w-full items-stretch gap-2 rounded-lg px-2 py-1 text-left text-xs ${mine ? "bg-white/15" : "bg-foreground/5"}`}
                  >
                    <span className={`w-0.5 rounded-full ${mine ? "bg-white/70" : "bg-primary"}`} />
                    <span className="min-w-0 flex-1">
                      <span className={`block font-semibold ${mine ? "text-white/90" : "text-primary"}`}>
                        {parent.sender_id === user?.id ? "Tú" : "Osit@"}
                      </span>
                      <span className={`block truncate ${mine ? "text-white/80" : "text-muted-foreground"}`}>
                        {messagePreview(parent)}
                      </span>
                    </span>
                  </button>
                )}

                {expiresIn !== null && (
                  <div className="text-[10px] opacity-70 flex items-center gap-1 mb-1">
                    <Timer className="h-3 w-3" />
                    {expiresIn > 0 ? `Se borra en ${expiresIn < 60 ? `${expiresIn}s` : expiresIn < 3600 ? `${Math.floor(expiresIn/60)}m` : `${Math.floor(expiresIn/3600)}h`}` : "Expirando..."}
                  </div>
                )}

                {m.sticker && <div className="text-5xl leading-none">{m.sticker}</div>}

                {m.image_url && (
                  <img src={imgUrls[m.image_url] ?? ""} alt="foto" className="max-h-64 rounded-xl object-cover" />
                )}

                {m.audio_url && audioUrls[m.audio_url] && (
                  <AudioPlayer src={audioUrls[m.audio_url]} />
                )}

                {m.content && (
                  <p className="whitespace-pre-wrap break-words text-sm">{m.content}</p>
                )}

                <div className={`mt-1 flex items-center gap-2 text-[10px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                  <span>{new Date(m.created_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</span>
                  <button
                    type="button"
                    onClick={() => startReply(m)}
                    aria-label="Responder"
                    className={`ml-auto rounded-full px-1.5 py-0.5 transition-opacity ${mine ? "hover:bg-white/15" : "hover:bg-foreground/10"}`}
                  >
                    <Reply className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPickerFor(pickerFor === m.id ? null : m.id)}
                    aria-label="Reaccionar"
                    className={`rounded-full px-1.5 py-0.5 transition-opacity ${mine ? "hover:bg-white/15" : "hover:bg-foreground/10"}`}
                  >
                    <Smile className="h-3 w-3" />
                  </button>
                </div>

                {mine && (
                  <button onClick={() => remove(m.id)} aria-label="Borrar"
                    className="absolute -left-7 top-1/2 hidden -translate-y-1/2 text-muted-foreground hover:text-destructive group-hover:block">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}

                {pickerFor === m.id && (
                  <div className={`absolute ${mine ? "right-0" : "left-0"} -top-10 flex gap-0.5 bg-card border border-border rounded-full px-1.5 py-1 shadow-lg z-20 animate-in fade-in zoom-in-95`}>
                    {REACTION_EMOJIS.map(emoji => (
                      <button key={emoji} onClick={() => toggleReaction(m.id, emoji, m.reactions)}
                        className="text-lg hover:scale-125 transition-transform px-1">
                        {emoji}
                      </button>
                    ))}
                    <button onClick={() => startReply(m)} className="text-base px-1.5 hover:scale-110 transition-transform" aria-label="Responder">
                      <Reply className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              {hasReactions && (
                <div className="flex gap-1 mt-1 flex-wrap">
                  {Object.entries(allReactions).filter(([, users]) => users.length > 0).map(([emoji, users]) => (
                    <button key={emoji} onClick={() => toggleReaction(m.id, emoji, m.reactions)}
                      className={`flex items-center gap-0.5 text-xs rounded-full px-2 py-0.5 border transition-colors ${users.includes(user?.id ?? "") ? "bg-primary/20 border-primary/40" : "bg-card border-border"}`}>
                      {emoji} <span>{users.length}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <div className="fixed bottom-16 left-0 right-0 z-30 border-t border-border/60 bg-card/90 backdrop-blur-lg">
        {replyTo && (
          <div className="mx-auto flex max-w-md items-stretch gap-2 px-3 pt-2">
            <div className="flex flex-1 items-stretch gap-2 rounded-lg bg-primary/10 px-2 py-1.5">
              <div className="w-0.5 rounded-full bg-primary" />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-primary flex items-center gap-1">
                  <Reply className="h-3 w-3" /> Respondiendo a {replyTo.sender_id === user?.id ? "ti" : "osit@"}
                </div>
                <div className="truncate text-xs text-muted-foreground">{messagePreview(replyTo)}</div>
              </div>
              <button onClick={() => setReplyTo(null)} aria-label="Cancelar respuesta" className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {showDestructMenu && (
          <div className="flex gap-2 px-3 pt-2 flex-wrap">
            <button onClick={() => { setSelfDestruct(null); setShowDestructMenu(false); }}
              className={`text-xs px-2 py-1 rounded-full border ${!selfDestruct ? "bg-primary text-primary-foreground" : "border-border"}`}>
              Normal
            </button>
            {SELF_DESTRUCT_OPTIONS.map(opt => (
              <button key={opt.seconds} onClick={() => { setSelfDestruct(opt.seconds); setShowDestructMenu(false); }}
                className={`text-xs px-2 py-1 rounded-full border ${selfDestruct === opt.seconds ? "bg-primary text-primary-foreground" : "border-border"}`}>
                ⏱ {opt.label}
              </button>
            ))}
          </div>
        )}

        <div className="mx-auto flex max-w-md items-center gap-2 px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <Popover>
            <PopoverTrigger asChild>
              <Button size="icon" variant="ghost" aria-label="Stickers"><Smile className="h-5 w-5" /></Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-2 pointer-events-auto" align="start" side="top">
              <div className="grid grid-cols-6 gap-1">
                {STICKERS.map((s) => (
                  <button key={s} onClick={() => onSticker(s)} className="rounded-lg p-2 text-2xl transition hover:bg-accent">{s}</button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <Button size="icon" variant="ghost" onClick={() => fileRef.current?.click()} disabled={busy} aria-label="Foto">
            <ImageIcon className="h-5 w-5" />
          </Button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => e.target.files?.[0] && onPickFile(e.target.files[0])} />

          <Button size="icon" variant={selfDestruct ? "default" : "ghost"}
            onClick={() => setShowDestructMenu(v => !v)} aria-label="Autodestrucción">
            <Timer className="h-5 w-5" />
          </Button>

          {recording ? (
            <div className="flex-1 flex items-center gap-2 bg-destructive/10 rounded-lg px-3 py-1.5">
              <span className="animate-pulse text-red-500">●</span>
              <span className="text-sm font-medium">{formatAudioTime(recordSecs)}</span>
              <span className="text-xs text-muted-foreground">Grabando...</span>
            </div>
          ) : (
            <Input ref={inputRef} value={text} onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSend()}
              placeholder={replyTo ? "Escribe tu respuesta…" : selfDestruct ? `⏱ Se borrará en ${SELF_DESTRUCT_OPTIONS.find(o => o.seconds === selfDestruct)?.label}` : "Escríbele algo bonito…"}
              className="flex-1" />
          )}

          {text.trim() ? (
            <Button size="icon" onClick={onSend} aria-label="Enviar"><Send className="h-4 w-4" /></Button>
          ) : (
            <Button size="icon" variant={recording ? "destructive" : "ghost"}
              onPointerDown={beginPress} onPointerUp={endPress} onPointerLeave={endPress} onPointerCancel={endPress}
              aria-label="Mantén presionado para grabar voz">
              {recording ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </Button>
          )}
        </div>
      </div>
    </AppShell>
  );
}
