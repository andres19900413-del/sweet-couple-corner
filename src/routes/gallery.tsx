import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ImagePlus, Trash2, Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/gallery")({
  head: () => ({
    meta: [
      { title: "Galería 📸" },
      { name: "description", content: "Nuestros recuerdos en fotos." },
    ],
  }),
  component: GalleryPage,
});

type Photo = {
  id: string;
  uploader_id: string;
  storage_path: string;
  caption: string | null;
  taken_on: string | null;
  created_at: string;
  url?: string;
};

function GalleryPage() {
  const { user } = useAuth();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState("");
  const [takenOn, setTakenOn] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("photos")
      .select("*")
      .order("taken_on", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("No se pudieron cargar las fotos");
      setLoading(false);
      return;
    }
    const withUrls = await Promise.all(
      (data ?? []).map(async (p) => {
        const { data: signed } = await supabase.storage
          .from("gallery")
          .createSignedUrl(p.storage_path, 3600);
        return { ...p, url: signed?.signedUrl } as Photo;
      }),
    );
    setPhotos(withUrls);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const onPickFile = () => fileRef.current?.click();

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Solo imágenes 🥲");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("gallery")
        .upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from("photos").insert({
        uploader_id: user.id,
        storage_path: path,
        caption: caption.trim() || null,
        taken_on: takenOn || null,
      });
      if (insErr) throw insErr;
      setCaption("");
      setTakenOn("");
      toast.success("Foto añadida 💕");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al subir");
    } finally {
      setUploading(false);
    }
  };

  const remove = async (p: Photo) => {
    if (!user || p.uploader_id !== user.id) return;
    if (!confirm("¿Borrar esta foto?")) return;
    await supabase.storage.from("gallery").remove([p.storage_path]);
    await supabase.from("photos").delete().eq("id", p.id);
    setPhotos((prev) => prev.filter((x) => x.id !== p.id));
  };

  return (
    <AppShell title="Galería">
      <p className="mb-5 text-sm text-muted-foreground">
        Guarda y revive vuestros momentos favoritos.
      </p>

      <div className="mb-6 flex flex-col gap-2 rounded-3xl border border-border/60 bg-card/80 p-4 shadow-soft backdrop-blur">
        <Input
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Una frase para esta foto (opcional)"
        />
        <Input
          type="date"
          value={takenOn}
          onChange={(e) => setTakenOn(e.target.value)}
        />
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onFileChange}
        />
        <Button onClick={onPickFile} disabled={uploading}>
          {uploading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <ImagePlus className="mr-2 h-4 w-4" />
          )}
          {uploading ? "Subiendo…" : "Añadir foto"}
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : photos.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card/40 px-4 py-8 text-center text-sm text-muted-foreground">
          Aún no hay fotos. Sube la primera 📷
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {photos.map((p) => (
            <figure
              key={p.id}
              className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card/80 shadow-soft"
            >
              {p.url ? (
                <img
                  src={p.url}
                  alt={p.caption ?? "Recuerdo"}
                  loading="lazy"
                  className="aspect-square w-full object-cover"
                />
              ) : (
                <div className="aspect-square w-full bg-muted" />
              )}
              {(p.caption || p.taken_on) && (
                <figcaption className="space-y-0.5 px-2 py-1.5 text-[11px]">
                  {p.taken_on && (
                    <time className="block font-medium uppercase tracking-wider text-primary">
                      {new Date(p.taken_on).toLocaleDateString("es-ES", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </time>
                  )}
                  {p.caption && (
                    <p className="line-clamp-2 text-foreground">{p.caption}</p>
                  )}
                </figcaption>
              )}
              {user?.id === p.uploader_id && (
                <button
                  onClick={() => remove(p)}
                  aria-label="Eliminar foto"
                  className="absolute right-1.5 top-1.5 rounded-full bg-background/80 p-1.5 text-muted-foreground opacity-0 backdrop-blur transition-opacity hover:text-destructive group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </figure>
          ))}
        </div>
      )}
    </AppShell>
  );
}
