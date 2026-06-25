import { createFileRoute } from "@tanstack/react-router";
import { Bell, CalendarDays, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/calendar")({
  head: () => ({ meta: [{ title: "Calendario 🗓️" }] }),
  component: CalendarPage,
});

type Event = {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  event_time: string | null;
  created_by: string;
};

const today = () => new Date().toISOString().slice(0, 10);

function CalendarPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(today());
  const [time, setTime] = useState("");
  const [desc, setDesc] = useState("");
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    const { data, error } = await supabase
      .from("calendar_events")
      .select("*")
      .order("event_date", { ascending: true });
    if (error) toast.error(error.message);
    else setEvents(data as Event[]);
  };

  useEffect(() => {
    load();
  }, []);

  const add = async () => {
    if (!user || !title.trim()) return;
    const { error } = await supabase.from("calendar_events").insert({
      title: title.trim(),
      description: desc.trim() || null,
      event_date: date,
      event_time: time || null,
      created_by: user.id,
    });
    if (error) return toast.error(error.message);
    setTitle("");
    setDesc("");
    setTime("");
    setDate(today());
    setShowForm(false);
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("calendar_events").delete().eq("id", id);
    if (error) toast.error(error.message);
    else load();
  };

  const todayIso = today();
  const upcoming = events.filter((e) => e.event_date >= todayIso);
  const past = events.filter((e) => e.event_date < todayIso).reverse();

  const reminders = upcoming.filter((e) => {
    const diff =
      (new Date(e.event_date).getTime() - new Date(todayIso).getTime()) /
      (1000 * 60 * 60 * 24);
    return diff <= 7;
  });

  return (
    <AppShell title="Calendario">
      {reminders.length > 0 && (
        <div className="mb-5 rounded-3xl border border-primary/30 bg-primary/10 p-4 shadow-soft">
          <div className="mb-2 flex items-center gap-2 text-primary">
            <Bell className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-widest">
              Próximamente
            </span>
          </div>
          <ul className="flex flex-col gap-1 text-sm">
            {reminders.map((r) => (
              <li key={r.id} className="flex justify-between gap-3">
                <span className="truncate">{r.title}</span>
                <span className="shrink-0 text-muted-foreground">
                  {formatShort(r.event_date)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!showForm ? (
        <Button onClick={() => setShowForm(true)} className="mb-6 w-full gap-2">
          <Plus className="h-4 w-4" /> Nuevo evento
        </Button>
      ) : (
        <div className="mb-6 flex flex-col gap-2 rounded-3xl border border-border/60 bg-card/80 p-4 shadow-soft backdrop-blur">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej. Aniversario 🎉"
          />
          <div className="flex gap-2">
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <Input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
          <Textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Detalles (opcional)"
            rows={2}
          />
          <div className="flex gap-2">
            <Button onClick={add} disabled={!title.trim()} className="flex-1">
              Guardar
            </Button>
            <Button variant="ghost" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      <Section title={`Próximos (${upcoming.length})`}>
        {upcoming.length === 0 ? (
          <Empty text="Sin eventos próximos." />
        ) : (
          upcoming.map((e) => (
            <EventRow key={e.id} ev={e} mine={e.created_by === user?.id} onDelete={() => remove(e.id)} />
          ))
        )}
      </Section>

      {past.length > 0 && (
        <Section title={`Pasados (${past.length})`}>
          {past.map((e) => (
            <EventRow key={e.id} ev={e} mine={e.created_by === user?.id} onDelete={() => remove(e.id)} faded />
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

function Empty({ text }: { text: string }) {
  return (
    <li className="rounded-2xl border border-dashed border-border bg-card/40 px-4 py-6 text-center text-sm text-muted-foreground">
      {text}
    </li>
  );
}

function EventRow({
  ev,
  mine,
  onDelete,
  faded,
}: {
  ev: Event;
  mine: boolean;
  onDelete: () => void;
  faded?: boolean;
}) {
  return (
    <li
      className={`flex items-start gap-3 rounded-2xl border border-border/60 bg-card/80 p-3 shadow-soft backdrop-blur ${
        faded ? "opacity-60" : ""
      }`}
    >
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
        <CalendarDays className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{ev.title}</p>
        <p className="text-xs text-primary">
          {formatLong(ev.event_date)}
          {ev.event_time && ` · ${ev.event_time.slice(0, 5)}`}
        </p>
        {ev.description && (
          <p className="mt-1 text-xs text-muted-foreground">{ev.description}</p>
        )}
      </div>
      {mine && (
        <button
          onClick={onDelete}
          aria-label="Eliminar"
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </li>
  );
}

function formatLong(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}
function formatShort(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
  });
}
