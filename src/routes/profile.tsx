import { createFileRoute } from "@tanstack/react-router";
import { Camera, ImagePlus, Loader2, Save, User } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImageCropper } from "@/components/ImageCropper";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Mi perfil" },
      { name: "description", content: "Edita tu foto, banner y datos." },
    ],
  }),
  component: ProfilePage,
});

async function uploadBlob(userId: string, blob: Blob, kind: "avatar" | "banner") {
  const path = `${userId}/${kind}-${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage
    .from("profiles")
    .upload(path, blob, { contentType: "image/jpeg", upsert: true });
  if (error) throw error;
  return path;
}

function ProfilePage() {
  const { user } = useAuth();
  const { profile, avatarSrc, bannerSrc, reload } = useProfile();
  const [name, setName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [savingPw, setSavingPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropKind, setCropKind] = useState<"avatar" | "banner" | null>(null);
  const avatarRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);

  const displayName = name || profile?.display_name || "";

  const pickFile = (f: File, kind: "avatar" | "banner") => {
    if (!f.type.startsWith("image/")) return toast.error("Solo imágenes 🥲");
    const reader = new FileReader();
    reader.onload = () => {
      setCropSrc(reader.result as string);
      setCropKind(kind);
    };
    reader.readAsDataURL(f);
  };

  const handleCropConfirm = async (blob: Blob) => {
    if (!user || !cropKind) return;
    setSaving(true);
    try {
      const path = await uploadBlob(user.id, blob, cropKind);
      const patch = cropKind === "avatar" ? { avatar_url: path } : { banner_url: path };
      const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
      if (error) throw error;
      toast.success(cropKind === "avatar" ? "Foto actualizada 💕" : "Banner actualizado ✨");
      setCropSrc(null);
      setCropKind(null);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo subir");
    } finally {
      setSaving(false);
    }
  };

  const saveName = async () => {
    if (!user || !name.trim()) return;
    setSavingName(true);
    const { error } = await supabase.from("profiles").update({ display_name: name.trim() }).eq("id", user.id);
    setSavingName(false);
    if (error) return toast.error(error.message);
    toast.success("Nombre guardado 💕");
    setName("");
    await reload();
  };

  const savePassword = async () => {
    if (pw1.length < 6) return toast.error("Mínimo 6 caracteres");
    if (pw1 !== pw2) return toast.error("Las contraseñas no coinciden");
    setSavingPw(true);
    const { error } = await supabase.auth.updateUser({ password: pw1 });
    setSavingPw(false);
    if (error) return toast.error(error.message);
    setPw1("");
    setPw2("");
    toast.success("Contraseña actualizada 🔒");
  };

  return (
    <AppShell title="Mi perfil">
      <section className="mb-6 overflow-hidden rounded-3xl border border-border/60 bg-card/80 shadow-soft backdrop-blur">
        <div
          className="relative h-48 w-full bg-gradient-to-br from-primary/40 to-accent/40 bg-cover bg-center"
          style={bannerSrc ? { backgroundImage: `url(${bannerSrc})` } : undefined}
        >
          <button
            type="button"
            onClick={() => bannerRef.current?.click()}
            className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-black/45 px-3 py-1.5 text-xs font-medium text-white backdrop-blur transition active:scale-95"
          >
            <ImagePlus className="h-3.5 w-3.5" />
            Cambiar banner
          </button>
          <input
            ref={bannerRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) pickFile(f, "banner");
              e.target.value = "";
            }}
          />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="relative">
              <div className="h-24 w-24 overflow-hidden rounded-full border-4 border-card bg-muted shadow-lg">
                {avatarSrc ? (
                  <img src={avatarSrc} alt="Perfil" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-3xl">
                    {profile?.avatar_emoji || "🧸"}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => avatarRef.current?.click()}
                className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md ring-2 ring-card transition active:scale-95"
                aria-label="Cambiar foto"
              >
                <Camera className="h-4 w-4" />
              </button>
              <input
                ref={avatarRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) pickFile(f, "avatar");
                  e.target.value = "";
                }}
              />
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center px-5 pb-5 pt-4">
          <p className="font-display text-xl">{profile?.display_name || "Sin nombre"}</p>
          <p className="text-xs text-muted-foreground">{user?.email}</p>
        </div>
      </section>

      <section className="mb-6 rounded-3xl border border-border/60 bg-card/80 p-5 shadow-soft backdrop-blur">
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg">
          <User className="h-4 w-4" /> Nombre de usuario
        </h2>
        <div className="flex gap-2">
          <Input
            value={displayName}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tu nombre"
          />
          <Button onClick={saveName} disabled={savingName || !name.trim()} className="gap-1.5">
            {savingName ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar
          </Button>
        </div>
      </section>

      <section className="rounded-3xl border border-border/60 bg-card/80 p-5 shadow-soft backdrop-blur">
        <h2 className="mb-1 font-display text-lg">Cambiar contraseña</h2>
        <p className="mb-3 text-sm text-muted-foreground">Mínimo 6 caracteres.</p>
        <div className="flex flex-col gap-2">
          <div>
            <Label htmlFor="pw1" className="text-xs">Nueva contraseña</Label>
            <Input id="pw1" type="password" value={pw1} onChange={(e) => setPw1(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="pw2" className="text-xs">Confirmar</Label>
            <Input id="pw2" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
          </div>
          <Button onClick={savePassword} disabled={savingPw || !pw1 || !pw2} className="mt-1">
            {savingPw ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Actualizar contraseña
          </Button>
        </div>
      </section>

      <ImageCropper
        open={!!cropSrc}
        onOpenChange={(v) => {
          if (!v) {
            setCropSrc(null);
            setCropKind(null);
          }
        }}
        src={cropSrc}
        aspect={cropKind === "banner" ? 16 / 9 : 1}
        cropShape={cropKind === "avatar" ? "round" : "rect"}
        title={cropKind === "avatar" ? "Ajusta tu foto" : "Ajusta el banner"}
        saving={saving}
        onConfirm={handleCropConfirm}
      />
    </AppShell>
  );
}
