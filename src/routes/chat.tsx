import { createFileRoute } from "@tanstack/react-router";
import { Image as ImageIcon, Mic, MicOff, Phone, Send, Smile, Timer, Trash2, Video } from "lucide-react";
import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  audio_url: string | null;
  sticker: string | null;
  type: string | null;
  expires_at: string | null;
  reactions: Record<string, string[]> | null;
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
  const [inCall, setInCall] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const recordTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Limpiar mensajes expirados
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

  // Signed URLs para imágenes
  useEffect(() => {
    const need = messages.filter((m) => m.image_url && !imgUrls[m.image_url]).map((m) => m.image_url!) as string[];
    if (!need.length) return;
    Promise.all(need.map(async (path) => {
      const { data } = await supabase.storage.from("chat-media").createSignedUrl(path, 3600);
      return [path, data?.signedUrl ?? ""] as const;
    })).then((entries) => setImgUrls(prev => { const next = { ...prev }; for (const [p, u] of entries) next[p] = u; return next; }));
  }, [messages, imgUrls]);

  // Signed URLs para audios
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
    });
    if (error) toast.error(error.message);
    setSelfDestruct(null);
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
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("chat-media").upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;
      await send({ image_url: path, type: "image" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error subiendo foto");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  // GRABAR AUDIO
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      audioChunks.current = [];
      mr.ondataavailable = (e) => audioChunks.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunks.current, { type: "audio/webm" });
        setBusy(true);
        try {
          const path = `${user!.id}/audio-${crypto.randomUUID()}.webm`;
          const { error } = await supabase.storage.from("chat-media").upload(path, blob, { contentType: "audio/webm" });
          if (error) throw error;
          await send({ audio_url: path, type: "audio" });
        } catch (err) {
          toast.error("Error enviando audio");
        } finally {
          setBusy(false);
        }
      };
      mr.start();
      mediaRecorder.current = mr;
      setRecording(true);
      setRecordSecs(0);
      recordTimer.current = setInterval(() => setRecordSecs(s => s + 1), 1000);
    } catch {
      toast.error("No se pudo acceder al micrófono");
    }
  };

  const stopRecording = () => {
    mediaRecorder.current?.stop();
    setRecording(false);
    if (recordTimer.current) clearInterval(recordTimer.current);
  };

  // REACCIONES
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

  // VIDEOLLAMADA - abre una sala de Whereby gratuita
  const startCall = (video: boolean) => {
    const roomName = `amor-${[user?.id].sort().join("-")}`;
    const url = `https://whereby.com/${roomName}?${video ? "" : "skipMediaPermissionPrompt&audioOnly=1"}`;
    window.open(url, "_blank");
    toast.success(video ? "📹 Videollamada iniciada — comparte el link con tu pareja" : "📞 Llamada iniciada");
  };

  return (
    <AppShell title="Chat">
      {/* Barra de llamadas */}
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

          return (
            <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
              <div className={`group relative max-w-[78%] rounded-2xl px-3 py-2 shadow-soft ${mine ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-card/90 text-foreground"}`}>
                {/* Autodestrucción badge */}
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

                <div className={`mt-1 text-[10px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                  {new Date(m.created_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                </div>

                {/* Botón eliminar (solo propios) */}
                {mine && (
                  <button onClick={() => remove(m.id)} aria-label="Borrar"
                    className="absolute -left-7 top-1/2 hidden -translate-y-1/2 text-muted-foreground hover:text-destructive group-hover:block">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}

                {/* Picker de reacciones al hacer hover */}
                <div className={`absolute ${mine ? "left-0 -translate-x-full" : "right-0 translate-x-full"} top-0 hidden group-hover:flex gap-0.5 bg-card border border-border rounded-full px-1 py-0.5 shadow-md z-10`}>
                  {REACTION_EMOJIS.map(emoji => (
                    <button key={emoji} onClick={() => toggleReaction(m.id, emoji, m.reactions)}
                      className="text-base hover:scale-125 transition-transform px-0.5">
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reacciones */}
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

      {/* INPUT AREA */}
      <div className="fixed bottom-16 left-0 right-0 z-30 border-t border-border/60 bg-card/90 backdrop-blur-lg">
        {/* Autodestrucción selector */}
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
          {/* Stickers */}
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

          {/* Foto */}
          <Button size="icon" variant="ghost" onClick={() => fileRef.current?.click()} disabled={busy} aria-label="Foto">
            <ImageIcon className="h-5 w-5" />
          </Button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => e.target.files?.[0] && onPickFile(e.target.files[0])} />

          {/* Autodestrucción */}
          <Button size="icon" variant={selfDestruct ? "default" : "ghost"}
            onClick={() => setShowDestructMenu(v => !v)} aria-label="Autodestrucción">
            <Timer className="h-5 w-5" />
          </Button>

          {/* Texto o grabando */}
          {recording ? (
            <div className="flex-1 flex items-center gap-2 bg-destructive/10 rounded-lg px-3 py-1.5">
              <span className="animate-pulse text-red-500">●</span>
              <span className="text-sm font-medium">{formatAudioTime(recordSecs)}</span>
              <span className="text-xs text-muted-foreground">Grabando...</span>
            </div>
          ) : (
            <Input value={text} onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSend()}
              placeholder={selfDestruct ? `⏱ Se borrará en ${SELF_DESTRUCT_OPTIONS.find(o => o.seconds === selfDestruct)?.label}` : "Escríbele algo bonito…"}
              className="flex-1" />
          )}

          {/* Micrófono / Enviar */}
          {text.trim() ? (
            <Button size="icon" onClick={onSend} aria-label="Enviar"><Send className="h-4 w-4" /></Button>
          ) : (
            <Button size="icon" variant={recording ? "destructive" : "ghost"}
              onPointerDown={startRecording} onPointerUp={stopRecording} onPointerLeave={stopRecording}
              aria-label="Grabar voz">
              {recording ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </Button>
          )}
        </div>
      </div>
    </AppShell>
  );
}
