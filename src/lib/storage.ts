import { useEffect, useState } from "react";

export const STORAGE_KEYS = {
  startDate: "rincon:startDate",
  bucket: "rincon:bucket",
  memories: "rincon:memories",
} as const;

export type BucketItem = {
  id: string;
  text: string;
  done: boolean;
  createdAt: string;
};

export type Memory = {
  id: string;
  text: string;
  date: string; // YYYY-MM-DD
  createdAt: string;
  author?: string;
};

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setValue(read<T>(key, initial));
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* noop */
    }
  }, [key, value, hydrated]);

  return [value, setValue, hydrated] as const;
}

export function exportAll(): string {
  const data: Record<string, unknown> = {};
  for (const k of Object.values(STORAGE_KEYS)) {
    const raw = window.localStorage.getItem(k);
    data[k] = raw ? JSON.parse(raw) : null;
  }
  return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), data }, null, 2);
}

export function importAll(text: string): { ok: boolean; message: string } {
  try {
    const parsed = JSON.parse(text);
    const data = parsed?.data ?? parsed;
    if (!data || typeof data !== "object") throw new Error("Formato inválido");
    for (const k of Object.values(STORAGE_KEYS)) {
      if (k in data && data[k] !== null && data[k] !== undefined) {
        window.localStorage.setItem(k, JSON.stringify(data[k]));
      }
    }
    return { ok: true, message: "Datos importados. Recargando…" };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Error al importar" };
  }
}

export function daysBetween(fromIso: string, to = new Date()): number {
  const from = new Date(fromIso);
  const ms = to.getTime() - from.getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}
