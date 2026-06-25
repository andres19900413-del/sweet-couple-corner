import { useEffect, useState } from "react";

export type ThemeKey = "blush" | "lavender" | "peach" | "mint" | "sky";

export const THEMES: { key: ThemeKey; label: string; swatch: string[] }[] = [
  { key: "blush", label: "Rosa", swatch: ["#f8d7e0", "#e8c5d0", "#c98aa6"] },
  { key: "lavender", label: "Lavanda", swatch: ["#e8dcf2", "#c9a0dc", "#9b72cf"] },
  { key: "peach", label: "Melocotón", swatch: ["#fde2cf", "#f8c5a0", "#e89770"] },
  { key: "mint", label: "Menta", swatch: ["#d6f0e0", "#a8d8c0", "#6db89a"] },
  { key: "sky", label: "Cielo", swatch: ["#d8e6f5", "#a8c5e8", "#6b8fc4"] },
];

export type Preferences = {
  themeKey: ThemeKey;
  myName: string;
  partnerName: string;
  emoji: string;
};

const PREFS_KEY = "rincon:prefs";

const DEFAULT_PREFS: Preferences = {
  themeKey: "blush",
  myName: "",
  partnerName: "",
  emoji: "💕",
};

function readPrefs(): Preferences {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<Preferences>) };
  } catch {
    return DEFAULT_PREFS;
  }
}

function applyTheme(themeKey: ThemeKey) {
  if (typeof document === "undefined") return;
  const cls = document.documentElement.classList;
  for (const c of Array.from(cls)) {
    if (c.startsWith("theme-")) cls.remove(c);
  }
  cls.add(`theme-${themeKey}`);
}

export function usePreferences() {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const p = readPrefs();
    setPrefs(p);
    applyTheme(p.themeKey);
    setHydrated(true);
  }, []);

  const update = (patch: Partial<Preferences>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      try {
        window.localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      } catch {
        /* noop */
      }
      if (patch.themeKey) applyTheme(patch.themeKey);
      return next;
    });
  };

  return { prefs, update, hydrated };
}

/** Apply persisted theme on first render anywhere in the app. */
export function useApplyTheme() {
  useEffect(() => {
    applyTheme(readPrefs().themeKey);
  }, []);
}
