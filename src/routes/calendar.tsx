import { createFileRoute } from "@tanstack/react-router";
import { Bell, BellOff, CalendarDays, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  reminder_lead_minutes: number | null;
  created_by: string;
};

const REMINDER_OPTIONS: { value: string; label: string; minutes: number | null }[] = [
  { value: "none", label: "Sin aviso", minutes: null },
  { value: "0", label: "A la hora del evento", minutes: 0 },
  { value: "15", label: "15 minutos antes", minutes: 15 },
  { value: "60", label: "1 hora antes", minutes: 60 },
  { value: "180", label: "3 horas antes", minutes: 180 },
  { value: "1440", label: "1 día antes", minutes: 1440 },
  { value: "4320", label: "3 días antes", minutes: 4320 },
  { value: "10080", label: "1 semana antes", minutes: 10080 },
];

const today = () => new Date().toISOString().slice(0, 10);

function eventInstant(ev: Pick<Event, "event_date" | "event_time">) {
  // If no time, treat as start of day in local time
  const [y, m, d] = ev.event_date.split("-").map(Number);
  if (ev.event_time) {
    const [hh, mm] = ev.event_time.split(":").map(Number);
    return new Date(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0).getTime();
  }
  return new Date(y, (m ?? 1) - 1, d ?? 1, 0, 0).getTime();
}

function CalendarPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(today());
  const [time, setTime] = useState("");
  const [desc, setDesc] = useState("");
  const [reminder, setReminder] = useState<string>("1440");
  const [showForm, setShowForm] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

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
    const opt = REMINDER_OPTIONS.find((o) => o.value === reminder);
    const { error } = await supabase.from("calendar_events").insert({
      title: title.trim(),
      description: desc.trim() || null,
      event_date: date,
      event_time: time || null,
      reminder_lead_minutes: opt?.minutes ?? null,
      created_by: user.id,
    });
    if (error) return toast.error(error.message);
    setTitle("");
    setDesc("");
    setTime("");
    setDate(today());
    setReminder("1440");
    setShowForm(false);
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("calendar_events").delete().eq("id", id);
    if (error) toast.error(error.message);
    else load();
  };

  const updateReminder = async (id: string, value: string) => {
    const opt = REMINDER_OPTIONS.find((o) => o.value === value);
    const { error } = await supabase
      .from("calendar_events")
      .update({ reminder_lead_minutes: opt?.minutes ?? null })
      .eq("id", id);
    if (error) toast.error(error.message);
    else load();
  };

  const todayIso = today();
  const upcoming = events.filter((e) => e.event_date >= todayIso);
  const past = events.filter((e) => e.event_date < todayIso).reverse();

  // Reminders: event in the future, within its lead window
  const reminders = upcoming.filter((e) => {
    if (e.reminder_lead_minutes == null) return false;
    const ts = eventInstant(e);
    if (ts < now) return false;
    const leadMs = e.reminder_lead_minutes * 60 * 1000;
    return ts - now <= leadMs;
  });

  return (
    <AppShell title="Calendario">
      {reminders.length > 0 && (
        <div className="mb-5 rounded-3xl border border-primary/30 bg-primary/10 p-4 shadow-soft">
          <div className="mb-2 flex items-center gap-2 text-primary">
            <Bell className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-widest">
              Recordatorios
            </span>
          </div>
          <ul className="flex flex-col gap-1 text-sm">
            {reminders.map((r) => (
              <li key={r.id} className="flex justify-between gap-3">
                <span className="truncate">{r.title}</span>
                <span className="shrink-0 text-muted-foreground">
                  {relative(eventInstant(r), now)}
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
        <div className="mb-6 flex flex-col gap-3 rounded-3xl border border-border/60 bg-card/80 p-4 shadow-soft backdrop-blur">
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
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">
              Aviso dentro de la app
            </Label>
            <Select value={reminder} onValueChange={setReminder}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="pointer-events-auto">
                {REMINDER_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Aparecerá como banner en esta pantalla. No se envían emails.
            </p>
          </div>
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
            <EventRow
              key={e.id}
              ev={e}
              mine={e.created_by === user?.id}
              onDelete={() => remove(e.id)}
              onReminderChange={(v) => updateReminder(e.id, v)}
            />
          ))
        )}
      </Section>

      {past.length > 0 && (
        <Section title={`Pasados (${past.length})`}>
          {past.map((e) => (
            <EventRow
              key={e.id}
              ev={e}
              mine={e.created_by === user?.id}
              onDelete={() => remove(e.id)}
              onReminderChange={(v) => updateReminder(e.id, v)}
              faded
            />
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
  onReminderChange,
  faded,
}: {
  ev: Event;
  mine: boolean;
  onDelete: () => void;
  onReminderChange: (value: string) => void;
  faded?: boolean;
}) {
  const reminderValue =
    ev.reminder_lead_minutes == null ? "none" : String(ev.reminder_lead_minutes);
  const reminderLabel =
    REMINDER_OPTIONS.find((o) => o.value === reminderValue)?.label ?? "Sin aviso";
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
        {mine && !faded ? (
          <div className="mt-2 flex items-center gap-1.5">
            {ev.reminder_lead_minutes == null ? (
              <BellOff className="h-3 w-3 text-muted-foreground" />
            ) : (
              <Bell className="h-3 w-3 text-primary" />
            )}
            <Select value={reminderValue} onValueChange={onReminderChange}>
              <SelectTrigger className="h-7 border-none bg-transparent px-1 py-0 text-[11px] text-muted-foreground shadow-none hover:text-foreground focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="pointer-events-auto">
                {REMINDER_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            {ev.reminder_lead_minutes == null ? (
              <BellOff className="h-3 w-3" />
            ) : (
              <Bell className="h-3 w-3" />
            )}
            {reminderLabel}
          </p>
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
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1).toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function relative(target: number, now: number): string {
  const diff = target - now;
  if (diff <= 0) return "ahora";
  const mins = Math.round(diff / 60_000);
  if (mins < 60) return `en ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `en ${hours} h`;
  const days = Math.round(hours / 24);
  return `en ${days} día${days === 1 ? "" : "s"}`;
}
