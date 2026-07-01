import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, Trash2, Loader2, Tag } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { usePreferences } from "@/lib/preferences";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/gallery")({
  head: () => ({
    meta: [
      { title: "Álbum 📸" },
      { name: "description", content: "Nuestro álbum compartido." },
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
  tagged_names: string[];
  created_at: string;
  url?: string;
};

function GalleryPage() {
  const { user } = useAuth();
  const { prefs } = usePreferences();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState("");
  const [takenOn, setTakenOn] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [filter, setFilter] = useState<string | null>(null);
  const [preview, setPreview] = useState<Photo | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);


  const tagOptions = useMemo(
    () => [prefs.myName, prefs.partnerName].filter((n): n is string => !!n.trim()),
    [prefs.myName, prefs.partnerName],
  );

  const toggleTag = (name: string) =>
    setTags((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));

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
        tagged_names: tags,
      });
      if (insErr) throw insErr;
      setCaption("");
      setTakenOn("");
      setTags([]);
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

  const visible = filter
    ? photos.filter((p) => p.tagged_names?.includes(filter))
    : photos;

  return (
    <AppShell title="Álbum">
      <p className="mb-5 text-sm text-muted-foreground">
        Vuestro álbum compartido. Sube fotos y etiqueta quién aparece.
      </p>

      <div className="mb-4 flex flex-col gap-2 rounded-3xl border border-border/60 bg-card/80 p-4 shadow-soft backdrop-blur">
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

        {tagOptions.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="mr-1 text-xs text-muted-foreground">Etiquetar:</span>
            {tagOptions.map((name) => {
              const active = tags.includes(name);
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => toggleTag(name)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    active
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border bg-card text-muted-foreground hover:text-foreground",
                  )}
                >
                  {name}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="pt-1 text-xs text-muted-foreground">
            Configura vuestros nombres en Ajustes para poder etiquetar.
          </p>
        )}

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

      {tagOptions.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setFilter(null)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              filter === null
                ? "border-primary bg-primary/15 text-primary"
                : "border-border bg-card text-muted-foreground",
            )}
          >
            Todas
          </button>
          {tagOptions.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setFilter(name)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                filter === name
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border bg-card text-muted-foreground",
              )}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : visible.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card/40 px-4 py-8 text-center text-sm text-muted-foreground">
          {filter ? `Sin fotos etiquetadas con ${filter}.` : "Aún no hay fotos. Sube la primera 📷"}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {visible.map((p) => (
            <figure
              key={p.id}
              className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card/80 shadow-soft"
            >
              {p.url ? (
                <button
                  type="button"
                  onClick={() => setPreview(p)}
                  className="block w-full"
                  aria-label="Ver foto"
                >
                  <img
                    src={p.url}
                    alt={p.caption ?? "Recuerdo"}
                    loading="lazy"
                    className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </button>
              ) : (
                <div className="aspect-square w-full bg-muted" />
              )}
              <figcaption className="space-y-1 px-2 py-1.5 text-[11px]">
                {p.taken_on && (
                  <time className="block font-medium uppercase tracking-wider text-primary">
                    {new Date(p.taken_on).toLocaleDateString("es-ES", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </time>
                )}
                {p.caption && <p className="line-clamp-2 text-foreground">{p.caption}</p>}
                {p.tagged_names?.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1 pt-0.5">
                    <Tag className="h-2.5 w-2.5 text-muted-foreground" />
                    {p.tagged_names.map((n) => (
                      <span
                        key={n}
                        className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
                      >
                        {n}
                      </span>
                    ))}
                  </div>
                )}
              </figcaption>
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

      {preview && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setPreview(null)}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/85 p-4 backdrop-blur-sm animate-in fade-in"
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setPreview(null);
            }}
            aria-label="Cerrar"
            className="absolute right-4 top-4 rounded-full bg-white/15 px-3 py-1 text-sm text-white hover:bg-white/25"
          >
            ✕
          </button>
          {preview.url && (
            <img
              src={preview.url}
              alt={preview.caption ?? "Recuerdo"}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[80vh] max-w-full rounded-2xl object-contain shadow-2xl"
            />
          )}
          {(preview.caption || preview.taken_on || preview.tagged_names?.length > 0) && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="mt-4 max-w-md space-y-1 rounded-2xl bg-black/40 px-4 py-3 text-center text-white"
            >
              {preview.taken_on && (
                <p className="text-xs uppercase tracking-widest text-white/70">
                  {new Date(preview.taken_on).toLocaleDateString("es-ES", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              )}
              {preview.caption && <p className="text-sm">{preview.caption}</p>}
              {preview.tagged_names?.length > 0 && (
                <div className="flex flex-wrap justify-center gap-1 pt-1">
                  {preview.tagged_names.map((n) => (
                    <span
                      key={n}
                      className="rounded-full bg-white/20 px-2 py-0.5 text-[11px]"
                    >
                      {n}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
