import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Lock, Mail, Plus, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/letters")({
  head: () => ({
    meta: [
      { title: "Cofre de cartas 💌" },
      { name: "description", content: "Cápsulas del tiempo: cartas que se abren en el futuro." },
    ],
  }),
  component: LettersPage,
});

type Letter = {
  id: string;
  author_id: string;
  title: string;
  content: string;
  unlock_at: string;
  opened_at: string | null;
  created_at: string;
};

type Profile = { id: string; display_name: string | null };

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function countdown(iso: string, now: number) {
  const diff = new Date(iso).getTime() - now;
  if (diff <= 0) return "¡Lista para abrir!";
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (d > 0) return `${d} día${d === 1 ? "" : "s"} ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
}

function LettersPage() {
  const { user } = useAuth();
  const [letters, setLetters] = useState<Letter[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [composerOpen, setComposerOpen] = useState(false);
  const [openLetter, setOpenLetter] = useState<Letter | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("letters")
      .select("*")
      .order("unlock_at", { ascending: true });
    if (!data) return;
    setLetters(data as Letter[]);
    const ids = Array.from(new Set(data.map((l) => l.author_id)));
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
  }, []);

  useEffect(() => {
    if (!user) return;
    load();
    const ch = supabase
      .channel("letters:rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "letters" },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, load]);

  const { locked, unlocked } = useMemo(() => {
    const l: Letter[] = [];
    const u: Letter[] = [];
    for (const it of letters) {
      if (new Date(it.unlock_at).getTime() > now) l.push(it);
      else u.push(it);
    }
    return { locked: l, unlocked: u };
  }, [letters, now]);

  const openIt = async (letter: Letter) => {
    setOpenLetter(letter);
    if (!letter.opened_at && new Date(letter.unlock_at).getTime() <= Date.now()) {
      await supabase
        .from("letters")
        .update({ opened_at: new Date().toISOString() })
        .eq("id", letter.id);
      load();
    }
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar esta carta?")) return;
    await supabase.from("letters").delete().eq("id", id);
    load();
  };

  if (!user) return null;

  return (
    <AppShell title="Cofre de cartas">
      <p className="mb-5 text-sm text-muted-foreground">
        Escribe cartas que se abrirán en una fecha futura. Una cápsula del tiempo para los dos. 💌
      </p>

      <Button onClick={() => setComposerOpen(true)} className="mb-6 w-full gap-2">
        <Plus className="h-4 w-4" /> Escribir una carta
      </Button>

      {unlocked.length > 0 && (
        <Section title={`Listas para abrir (${unlocked.length})`}>
          {unlocked.map((l) => (
            <LetterCard
              key={l.id}
              letter={l}
              authorName={profiles[l.author_id] ?? "Osit@"}
              locked={false}
              isMine={l.author_id === user.id}
              onOpen={() => openIt(l)}
              onDelete={() => remove(l.id)}
              now={now}
            />
          ))}
        </Section>
      )}

      {locked.length > 0 && (
        <Section title={`Selladas (${locked.length})`}>
          {locked.map((l) => (
            <LetterCard
              key={l.id}
              letter={l}
              authorName={profiles[l.author_id] ?? "Osit@"}
              locked
              isMine={l.author_id === user.id}
              onOpen={() => openIt(l)}
              onDelete={() => remove(l.id)}
              now={now}
            />
          ))}
        </Section>
      )}

      {letters.length === 0 && (
        <div className="rounded-3xl border border-dashed border-border bg-card/40 px-4 py-10 text-center text-sm text-muted-foreground">
          El cofre está vacío. Escribe la primera carta 💕
        </div>
      )}

      {composerOpen && (
        <Composer
          userId={user.id}
          onClose={() => setComposerOpen(false)}
          onSaved={() => {
            setComposerOpen(false);
            load();
            toast("Carta guardada en el cofre 💌");
          }}
        />
      )}

      {openLetter && (
        <LetterReader
          letter={openLetter}
          authorName={profiles[openLetter.author_id] ?? "Osit@"}
          locked={new Date(openLetter.unlock_at).getTime() > now}
          onClose={() => setOpenLetter(null)}
        />
      )}
    </AppShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {title}
      </h2>
      <ul className="flex flex-col gap-3">{children}</ul>
    </section>
  );
}

function LetterCard({
  letter,
  authorName,
  locked,
  isMine,
  onOpen,
  onDelete,
  now,
}: {
  letter: Letter;
  authorName: string;
  locked: boolean;
  isMine: boolean;
  onOpen: () => void;
  onDelete: () => void;
  now: number;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "group relative flex w-full items-start gap-3 rounded-2xl border p-4 text-left shadow-soft transition active:scale-[.98]",
          locked
            ? "border-border/60 bg-card/70"
            : "border-primary/40 bg-gradient-to-br from-primary/10 to-accent/10",
        )}
      >
        <div
          className={cn(
            "grid h-11 w-11 shrink-0 place-items-center rounded-full text-primary-foreground",
            locked ? "bg-muted-foreground/60" : "",
          )}
          style={!locked ? { backgroundImage: "var(--gradient-romance)" } : undefined}
        >
          {locked ? <Lock className="h-5 w-5" /> : <Mail className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-base text-foreground">{letter.title}</p>
          <p className="text-xs text-muted-foreground">
            de {authorName} · {locked ? `se abre el ${fmtDate(letter.unlock_at)}` : `abierta el ${fmtDate(letter.unlock_at)}`}
          </p>
          {locked ? (
            <p className="mt-1 text-xs font-medium text-primary">⏳ {countdown(letter.unlock_at, now)}</p>
          ) : letter.opened_at ? (
            <p className="mt-1 text-xs text-muted-foreground">Leída ✨</p>
          ) : (
            <p className="mt-1 text-xs font-medium text-primary">Nueva ✨ Toca para abrir</p>
          )}
        </div>
        {isMine && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="rounded-full p-1 text-muted-foreground hover:text-destructive"
            aria-label="Eliminar"
          >
            <Trash2 className="h-4 w-4" />
          </span>
        )}
      </button>
    </li>
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
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const tomorrow = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }, []);
  const [date, setDate] = useState(tomorrow);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!title.trim() || !content.trim() || !date) {
      toast.error("Falta el título, el contenido o la fecha");
      return;
    }
    const unlock = new Date(date + "T09:00:00");
    if (unlock.getTime() <= Date.now()) {
      toast.error("La fecha debe ser en el futuro");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("letters").insert({
      author_id: userId,
      title: title.trim(),
      content: content.trim(),
      unlock_at: unlock.toISOString(),
    });
    setSaving(false);
    if (error) {
      toast.error("No se pudo guardar 😔");
      return;
    }
    onSaved();
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
          <p className="font-display text-lg">Nueva carta 💌</p>
          <button onClick={onClose} className="rounded-full p-1 text-muted-foreground" aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <label className="mb-3 block">
          <span className="mb-1 block text-xs text-muted-foreground">Título</span>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Para cuando cumplamos un año…"
            maxLength={80}
          />
        </label>

        <label className="mb-3 block">
          <span className="mb-1 block text-xs text-muted-foreground">Se abre el</span>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            min={tomorrow}
          />
        </label>

        <label className="mb-4 block">
          <span className="mb-1 block text-xs text-muted-foreground">Tu carta</span>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={8}
            placeholder="Escribe todo lo que sientes…"
            maxLength={4000}
          />
        </label>

        <Button onClick={save} disabled={saving} className="w-full">
          {saving ? "Sellando…" : "Sellar en el cofre 🔒"}
        </Button>
      </div>
    </div>
  );
}

function LetterReader({
  letter,
  authorName,
  locked,
  onClose,
}: {
  letter: Letter;
  authorName: string;
  locked: boolean;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-background/80 px-4 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="relative max-h-[85vh] w-full max-w-md overflow-y-auto rounded-3xl border border-border/60 bg-card p-6 shadow-soft"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground"
          aria-label="Cerrar"
        >
          <X className="h-5 w-5" />
        </button>

        {locked ? (
          <div className="py-10 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-muted text-muted-foreground">
              <Lock className="h-7 w-7" />
            </div>
            <p className="mt-4 font-display text-lg">{letter.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Esta carta se abre el {fmtDate(letter.unlock_at)}.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">De {authorName}</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 text-primary">
              <Sparkles className="h-4 w-4" />
              <p className="text-xs uppercase tracking-widest">Carta abierta</p>
            </div>
            <h1 className="mt-2 font-display text-2xl text-foreground">{letter.title}</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              De {authorName} · {fmtDate(letter.unlock_at)}
            </p>
            <div className="mt-5 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {letter.content}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
