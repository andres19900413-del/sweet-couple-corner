import { createFileRoute } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [{ title: "Entra a Nuestro Rinconcito 💕" }],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: name || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("¡Cuenta creada! Ya puedes entrar 💕");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Algo salió mal");
    } finally {
      setBusy(false);
    }
  };

  const onGoogle = async () => {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) toast.error("No se pudo iniciar con Google");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
      <div className="mb-8 flex flex-col items-center text-center">
        <div
          className="grid h-16 w-16 place-items-center rounded-full text-primary-foreground shadow-soft"
          style={{ backgroundImage: "var(--gradient-romance)" }}
        >
          <Heart className="h-8 w-8 fill-current" />
        </div>
        <h1 className="mt-4 font-display text-3xl">Nuestro Rinconcito</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "signin" ? "Bienvenid@ de vuelta 💕" : "Crea tu cuenta privada"}
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="flex flex-col gap-3 rounded-3xl border border-border/60 bg-card/80 p-5 shadow-soft backdrop-blur"
      >
        {mode === "signup" && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Tu nombre</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Ana"
            />
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Contraseña</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
          />
        </div>
        <Button type="submit" disabled={busy} className="mt-2">
          {mode === "signin" ? "Entrar 💕" : "Crear cuenta"}
        </Button>

        <div className="relative my-2 text-center text-xs text-muted-foreground">
          <span className="bg-card/80 px-2">o</span>
          <div className="absolute inset-x-0 top-1/2 -z-10 h-px bg-border" />
        </div>

        <Button type="button" variant="secondary" onClick={onGoogle} disabled={busy}>
          Continuar con Google
        </Button>
      </form>

      <button
        type="button"
        onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        className="mt-5 text-center text-sm text-muted-foreground hover:text-primary"
      >
        {mode === "signin"
          ? "¿No tienes cuenta? Crear una"
          : "¿Ya tienes cuenta? Entrar"}
      </button>
    </div>
  );
}
