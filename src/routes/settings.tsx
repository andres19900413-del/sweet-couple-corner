import { createFileRoute } from "@tanstack/react-router";
import { Download, LogOut, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { exportAll, importAll } from "@/lib/storage";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Ajustes" },
      { name: "description", content: "Copia de seguridad de tus datos." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, signOut } = useAuth();
  const [text, setText] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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
