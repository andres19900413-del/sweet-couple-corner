/**
 * Comprime una imagen en el navegador antes de subirla, para ahorrar
 * espacio en el 1 GB gratis de Supabase Storage sin que se note la
 * diferencia visual.
 *
 * Estrategia (la misma que usan apps como WhatsApp/Instagram para "fotos
 * normales"): si la imagen es más grande que MAX_DIMENSION en su lado más
 * largo, se reduce manteniendo la proporción; y se re-codifica como JPEG
 * con calidad alta (no máxima) — ahí es donde se gana la mayoría del
 * espacio, porque los celulares modernos suben fotos con muchísima más
 * resolución de la que cualquier pantalla necesita mostrar.
 *
 * No usa ninguna librería externa (solo Canvas, ya viene en el navegador),
 * así que no toca package.json ni package-lock.json.
 */

const MAX_DIMENSION = 1920; // lado más largo, en píxeles — de sobra para ver bien en cualquier celular o monitor
const JPEG_QUALITY = 0.82; // 0.8–0.85 es el punto dulce: la diferencia visual es prácticamente imperceptible

export async function compressImage(file: File): Promise<File> {
  // Si no es una imagen, o es un GIF (animado — comprimirlo lo rompe), la dejamos igual.
  if (!file.type.startsWith("image/") || file.type === "image/gif") {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);

    let { width, height } = bitmap;
    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      if (width > height) {
        height = Math.round((height * MAX_DIMENSION) / width);
        width = MAX_DIMENSION;
      } else {
        width = Math.round((width * MAX_DIMENSION) / height);
        height = MAX_DIMENSION;
      }
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );
    if (!blob) return file;

    // Si por lo que sea la "compresión" salió más pesada que el original
    // (pasa a veces con imágenes ya muy comprimidas), nos quedamos con el original.
    if (blob.size >= file.size) return file;

    const newName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], newName, { type: "image/jpeg" });
  } catch {
    // Si algo falla (formato raro, navegador viejo, etc.), subimos el original
    // en vez de romper la subida por completo.
    return file;
  }
}
