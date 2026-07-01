import { createFileRoute } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ThinkingOfYou } from "@/components/ThinkingOfYou";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePreferences } from "@/lib/preferences";
import { STORAGE_KEYS, daysBetween, useLocalStorage } from "@/lib/storage";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Nuestro Rinconcito 💕" },
      { name: "description", content: "Contador de días y nuestro espacio privado." },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const [startDate, setStartDate, hydrated] = useLocalStorage<string | null>(
    STORAGE_KEYS.startDate,
    null,
  );
  const { prefs } = usePreferences();
  const [draft, setDraft] = useState("");
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000 * 30);
    return () => clearInterval(t);
  }, []);

  if (!hydrated) return <AppShell>{null}</AppShell>;

  if (!startDate) {
    return (
      <AppShell title="Nuestro inicio">
        <p className="mb-4 text-sm text-muted-foreground">
          Elige el día en que empezó nuestra historia.
        </p>
        <div className="flex flex-col gap-3">
          <Input
            type="date"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            max={new Date().toISOString().slice(0, 10)}
          />
          <Button
            disabled={!draft}
            onClick={() => setStartDate(new Date(draft).toISOString())}
          >
            Guardar
          </Button>
        </div>
      </AppShell>
    );
  }

  const days = daysBetween(startDate, now);
  const from = new Date(startDate);
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  const remDays = days - years * 365 - months * 30;

  return (
    <AppShell>
      <div className="flex flex-col items-center pt-6 text-center">
        <div
          className="grid h-20 w-20 place-items-center rounded-full text-primary-foreground shadow-soft"
          style={{ backgroundImage: "var(--gradient-romance)" }}
        >
          <Heart className="h-10 w-10 fill-current" />
        </div>
        <p className="mt-6 font-display text-sm uppercase tracking-[0.2em] text-muted-foreground">
          {prefs.myName && prefs.partnerName
            ? `${prefs.myName} & ${prefs.partnerName}`
            : "Llevamos juntos"}
        </p>
        <p className="mt-2 font-display text-7xl font-semibold text-primary">
          {days}
        </p>
        <p className="font-display text-xl text-foreground">días {prefs.emoji}</p>
        <p className="mt-3 text-sm text-muted-foreground">
          {years > 0 && `${years} año${years > 1 ? "s" : ""}, `}
          {months > 0 && `${months} mes${months > 1 ? "es" : ""}, `}
          {remDays} día{remDays === 1 ? "" : "s"}
        </p>

        <div className="mt-10 w-full rounded-3xl border border-border/60 bg-card/70 p-5 backdrop-blur shadow-soft">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Desde
          </p>
          <p className="mt-1 font-display text-lg text-foreground">
            {from.toLocaleDateString("es-ES", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>

        <p className="mt-10 max-w-xs text-sm text-muted-foreground">
          Cada día contigo es un regalo. Sigamos sumando recuerdos. ✨
        </p>
      </div>
    </AppShell>
  );
}
