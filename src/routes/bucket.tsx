import { createFileRoute } from "@tanstack/react-router";
import { Check, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { STORAGE_KEYS, type BucketItem, useLocalStorage } from "@/lib/storage";

export const Route = createFileRoute("/bucket")({
  head: () => ({
    meta: [
      { title: "Nuestros planes 💖" },
      { name: "description", content: "Lista de planes por hacer juntos." },
    ],
  }),
  component: BucketPage,
});

function BucketPage() {
  const [items, setItems] = useLocalStorage<BucketItem[]>(STORAGE_KEYS.bucket, []);
  const [text, setText] = useState("");

  const add = () => {
    const t = text.trim();
    if (!t) return;
    setItems([
      { id: crypto.randomUUID(), text: t, done: false, createdAt: new Date().toISOString() },
      ...items,
    ]);
    setText("");
  };

  const toggle = (id: string) =>
    setItems(items.map((i) => (i.id === id ? { ...i, done: !i.done } : i)));
  const remove = (id: string) => setItems(items.filter((i) => i.id !== id));

  const pending = items.filter((i) => !i.done);
  const done = items.filter((i) => i.done);

  return (
    <AppShell title="Nuestros planes">
      <p className="mb-5 text-sm text-muted-foreground">
        Sueños y planes para hacer juntos.
      </p>

      <div className="mb-6 flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Ej. Viajar a Japón 🌸"
        />
        <Button onClick={add} size="icon" aria-label="Añadir">
          <Plus className="h-5 w-5" />
        </Button>
      </div>

      <Section title={`Por hacer (${pending.length})`}>
        {pending.length === 0 ? (
          <EmptyHint text="Aún no hay planes. ¡Añade el primero!" />
        ) : (
          pending.map((i) => (
            <Row key={i.id} item={i} onToggle={() => toggle(i.id)} onRemove={() => remove(i.id)} />
          ))
        )}
      </Section>

      {done.length > 0 && (
        <Section title={`Cumplidos (${done.length})`}>
          {done.map((i) => (
            <Row key={i.id} item={i} onToggle={() => toggle(i.id)} onRemove={() => remove(i.id)} />
          ))}
        </Section>
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
      <ul className="flex flex-col gap-2">{children}</ul>
    </section>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <li className="rounded-2xl border border-dashed border-border bg-card/40 px-4 py-6 text-center text-sm text-muted-foreground">
      {text}
    </li>
  );
}

function Row({
  item,
  onToggle,
  onRemove,
}: {
  item: BucketItem;
  onToggle: () => void;
  onRemove: () => void;
}) {
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/80 p-3 shadow-soft backdrop-blur">
      <button
        onClick={onToggle}
        aria-label="Marcar"
        className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 transition ${
          item.done
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-background"
        }`}
      >
        {item.done && <Check className="h-4 w-4" />}
      </button>
      <span
        className={`flex-1 text-sm ${
          item.done ? "text-muted-foreground line-through" : "text-foreground"
        }`}
      >
        {item.text}
      </span>
      <button
        onClick={onRemove}
        aria-label="Eliminar"
        className="text-muted-foreground hover:text-destructive"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
}
