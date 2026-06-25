import { createFileRoute } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { STORAGE_KEYS, type Memory, useLocalStorage } from "@/lib/storage";

export const Route = createFileRoute("/memories")({
  head: () => ({
    meta: [
      { title: "Muro de recuerdos 💌" },
      { name: "description", content: "Notas y momentos especiales." },
    ],
  }),
  component: MemoriesPage,
});

const today = () => new Date().toISOString().slice(0, 10);

function MemoriesPage() {
  const [items, setItems] = useLocalStorage<Memory[]>(STORAGE_KEYS.memories, []);
  const [text, setText] = useState("");
  const [date, setDate] = useState(today());
  const [author, setAuthor] = useState("");

  const add = () => {
    const t = text.trim();
    if (!t) return;
    setItems([
      {
        id: crypto.randomUUID(),
        text: t,
        date,
        author: author.trim() || undefined,
        createdAt: new Date().toISOString(),
      },
      ...items,
    ]);
    setText("");
    setAuthor("");
    setDate(today());
  };

  const remove = (id: string) => setItems(items.filter((i) => i.id !== id));

  const sorted = [...items].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <AppShell title="Recuerdos">
      <p className="mb-5 text-sm text-muted-foreground">
        Pequeñas notas para recordar siempre.
      </p>

      <div className="mb-6 flex flex-col gap-2 rounded-3xl border border-border/60 bg-card/80 p-4 shadow-soft backdrop-blur">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Una tarde de café, una sonrisa, un te quiero…"
          rows={3}
        />
        <div className="flex gap-2">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Input
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="Tu nombre (opcional)"
          />
        </div>
        <Button onClick={add} disabled={!text.trim()}>
          Guardar recuerdo
        </Button>
      </div>

      {sorted.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card/40 px-4 py-8 text-center text-sm text-muted-foreground">
          Todavía no hay recuerdos. Escribe el primero 💕
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {sorted.map((m) => (
            <li
              key={m.id}
              className="relative rounded-3xl border border-border/60 bg-card/85 p-4 shadow-soft backdrop-blur"
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <time className="text-xs font-medium uppercase tracking-widest text-primary">
                  {new Date(m.date).toLocaleDateString("es-ES", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </time>
                <button
                  onClick={() => remove(m.id)}
                  aria-label="Eliminar"
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <p className="whitespace-pre-wrap text-sm text-foreground">{m.text}</p>
              {m.author && (
                <p className="mt-2 text-xs italic text-muted-foreground">— {m.author}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
