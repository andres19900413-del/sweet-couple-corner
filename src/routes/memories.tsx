import { createFileRoute } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { usePreferences } from "@/lib/preferences";

export const Route = createFileRoute("/memories")({
  head: () => ({ meta: [{ title: "Muro de notas 💌" }] }),
  component: MemoriesPage,
});

type Note = {
  id: string;
  author_id: string;
  author_name: string | null;
  content: string;
  color: string;
  created_at: string;
};

const COLORS = [
  { key: "blush", label: "Rosa", bg: "bg-pink-100", ring: "ring-pink-300", tape: "bg-pink-200" },
  { key: "lavender", label: "Lavanda", bg: "bg-purple-100", ring: "ring-purple-300", tape: "bg-purple-200" },
  { key: "peach", label: "Melocotón", bg: "bg-orange-100", ring: "ring-orange-300", tape: "bg-orange-200" },
  { key: "mint", label: "Menta", bg: "bg-emerald-100", ring: "ring-emerald-300", tape: "bg-emerald-200" },
  { key: "sky", label: "Cielo", bg: "bg-sky-100", ring: "ring-sky-300", tape: "bg-sky-200" },
  { key: "lemon", label: "Limón", bg: "bg-yellow-100", ring: "ring-yellow-300", tape: "bg-yellow-200" },
] as const;

const colorOf = (k: string) => COLORS.find((c) => c.key === k) ?? COLORS[0];

function MemoriesPage() {
  const { user } = useAuth();
  const { prefs } = usePreferences();
  const [notes, setNotes] = useState<Note[]>([]);
  const [text, setText] = useState("");
  const [color, setColor] = useState<string>("blush");

  useEffect(() => {
    let mounted = true;
    supabase
      .from("notes")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300)
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) toast.error(error.message);
        else setNotes((data ?? []) as Note[]);
      });

    const ch = supabase
      .channel("notes")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notes" }, (p) =>
        setNotes((n) => [p.new as Note, ...n]),
      )
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "notes" }, (p) =>
        setNotes((n) => n.filter((x) => x.id !== (p.old as Note).id)),
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(ch);
    };
  }, []);

  const add = async () => {
    if (!user) return;
    const t = text.trim();
    if (!t) return;
    const { error } = await supabase.from("notes").insert({
      author_id: user.id,
      author_name: prefs.myName || null,
      content: t,
      color,
    });
    if (error) toast.error(error.message);
    else setText("");
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("notes").delete().eq("id", id);
    if (error) toast.error(error.message);
  };

  return (
    <AppShell title="Notas">
      <p className="mb-4 text-sm text-muted-foreground">
        Pequeños post-its para recordar siempre 💕
      </p>

      <div className="mb-6 flex flex-col gap-3 rounded-3xl border border-border/60 bg-card/80 p-4 shadow-soft backdrop-blur">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Te amo, gracias por hoy, una tarde de café…"
          rows={3}
        />
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Color:</span>
          {COLORS.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setColor(c.key)}
              aria-label={c.label}
              className={`h-7 w-7 rounded-full ${c.bg} ring-2 transition ${
                color === c.key ? `${c.ring} scale-110` : "ring-transparent"
              }`}
            />
          ))}
        </div>
        <Button onClick={add} disabled={!text.trim()}>
          Pegar nota
        </Button>
      </div>

      {notes.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card/40 px-4 py-8 text-center text-sm text-muted-foreground">
          Todavía no hay notas. Pega la primera 💕
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3">
          {notes.map((n, i) => {
            const c = colorOf(n.color);
            const mine = n.author_id === user?.id;
            const rotate = i % 2 === 0 ? "-rotate-1" : "rotate-1";
            const when = new Date(n.created_at);
            return (
              <li
                key={n.id}
                className={`relative ${c.bg} ${rotate} rounded-sm p-3 pt-5 shadow-md transition hover:rotate-0`}
              >
                <span
                  className={`absolute -top-2 left-1/2 h-3 w-12 -translate-x-1/2 ${c.tape} rounded-sm opacity-80 shadow-sm`}
                  aria-hidden
                />
                <p className="whitespace-pre-wrap break-words font-handwriting text-sm leading-snug text-slate-800">
                  {n.content}
                </p>
                <div className="mt-3 flex items-end justify-between gap-1 text-[10px] text-slate-600">
                  <div>
                    <div className="font-semibold">
                      {n.author_name || (mine ? "Tú" : "Tu pareja")}
                    </div>
                    <time>
                      {when.toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
                      {" · "}
                      {when.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                    </time>
                  </div>
                  {mine && (
                    <button
                      onClick={() => remove(n.id)}
                      aria-label="Eliminar"
                      className="text-slate-500 hover:text-rose-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </AppShell>
  );
}
