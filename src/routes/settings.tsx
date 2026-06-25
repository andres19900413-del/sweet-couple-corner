import { createFileRoute } from "@tanstack/react-router";
import { Check, Download, LogOut, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { THEMES, usePreferences } from "@/lib/preferences";
import { STORAGE_KEYS, exportAll, importAll, useLocalStorage } from "@/lib/storage";

const EMOJIS = ["💕", "💖", "💘", "💞", "❤️", "🌸", "🌷", "✨", "🦋", "🧸"];

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Ajustes" },
      { name: "description", content: "Personaliza tu rinconcito." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, signOut } = useAuth();
  const { prefs, update } = usePreferences();
  const [startDate, setStartDate] = useLocalStorage<string | null>(
    STORAGE_KEYS.startDate,
    null,
  );
  const [text, setText] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const startDateValue = startDate ? new Date(startDate).toISOString().slice(0, 10) : "";

  const doExport = () => {
    const data = exportAll();
    setText(data);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rinconcito-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus("Exportado ✨");
  };

  const doImport = () => {
    if (!text.trim()) {
      setStatus("Pega los datos primero");
      return;
    }
    const res = importAll(text);
    setStatus(res.message);
    if (res.ok) setTimeout(() => window.location.reload(), 600);
  };

  const onFile = async (f: File) => {
    const t = await f.text();
    setText(t);
  };

  return (
    <AppShell title="Ajustes">
      <section className="mb-6 rounded-3xl border border-border/60 bg-card/80 p-5 shadow-soft backdrop-blur">
        <h2 className="mb-1 font-display text-lg">Tu cuenta</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Conectad@ como <span className="font-medium text-foreground">{user?.email}</span>
        </p>
        <Button variant="secondary" onClick={signOut} className="gap-2">
          <LogOut className="h-4 w-4" /> Cerrar sesión
        </Button>
      </section>

      <section className="mb-6 rounded-3xl border border-border/60 bg-card/80 p-5 shadow-soft backdrop-blur">
        <h2 className="mb-3 font-display text-lg">Nuestros nombres</h2>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="myName">Tú</Label>
            <Input
              id="myName"
              value={prefs.myName}
              onChange={(e) => update({ myName: e.target.value })}
              placeholder="Tu nombre"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="partnerName">Tu pareja</Label>
            <Input
              id="partnerName"
              value={prefs.partnerName}
              onChange={(e) => update({ partnerName: e.target.value })}
              placeholder="Su nombre"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Emoji favorito</Label>
            <div className="flex flex-wrap gap-1.5">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => update({ emoji: e })}
                  className={`grid h-10 w-10 place-items-center rounded-xl border text-xl transition ${
                    prefs.emoji === e
                      ? "border-primary bg-primary/15"
                      : "border-border bg-card hover:bg-accent"
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mb-6 rounded-3xl border border-border/60 bg-card/80 p-5 shadow-soft backdrop-blur">
        <h2 className="mb-1 font-display text-lg">Nuestra fecha de inicio</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          El día en que empezó vuestra historia 💕
        </p>
        <Input
          type="date"
          value={startDateValue}
          max={new Date().toISOString().slice(0, 10)}
          onChange={(e) =>
            setStartDate(e.target.value ? new Date(e.target.value).toISOString() : null)
          }
        />
      </section>

      <section className="mb-6 rounded-3xl border border-border/60 bg-card/80 p-5 shadow-soft backdrop-blur">
        <h2 className="mb-1 font-display text-lg">Paleta pastel</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Elige el tono que más os represente.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {THEMES.map((t) => {
            const active = prefs.themeKey === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => update({ themeKey: t.key })}
                className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition ${
                  active
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card hover:bg-accent/40"
                }`}
              >
                <div className="flex -space-x-2">
                  {t.swatch.map((c) => (
                    <span
                      key={c}
                      className="h-7 w-7 rounded-full border-2 border-card"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <span className="flex-1 text-sm font-medium">{t.label}</span>
                {active && <Check className="h-4 w-4 text-primary" />}
              </button>
            );
          })}
        </div>
      </section>


      <section className="mb-6 rounded-3xl border border-border/60 bg-card/80 p-5 shadow-soft backdrop-blur">
        <h2 className="mb-1 font-display text-lg">Copia de planes y recuerdos</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Tus datos solo viven en este navegador. Exporta de vez en cuando para no perderlos.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={doExport} className="gap-2">
            <Download className="h-4 w-4" /> Exportar
          </Button>
          <Button
            variant="secondary"
            onClick={() => fileRef.current?.click()}
            className="gap-2"
          >
            <Upload className="h-4 w-4" /> Cargar archivo
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json,.txt"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
        </div>
      </section>

      <section className="rounded-3xl border border-border/60 bg-card/80 p-5 shadow-soft backdrop-blur">
        <h2 className="mb-2 font-display text-lg">Datos (texto)</h2>
        <Textarea
          rows={10}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Pega aquí los datos exportados para importarlos…"
          className="font-mono text-xs"
        />
        <div className="mt-3 flex items-center justify-between gap-2">
          <Button onClick={doImport} variant="default">
            Importar
          </Button>
          {status && <span className="text-xs text-muted-foreground">{status}</span>}
        </div>
      </section>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        Hecho con 💕 para nosotros
      </p>
    </AppShell>
  );
}
