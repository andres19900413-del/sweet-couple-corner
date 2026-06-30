import { useEffect, useState } from "react";

export type ThemeKey = "blush" | "lavender" | "peach" | "mint" | "sky";

export const THEMES: { key: ThemeKey; label: string; swatch: string[] }[] = [
  { key: "blush", label: "Rosa", swatch: ["#f8d7e0", "#e8c5d0", "#c98aa6"] },
  { key: "lavender", label: "Lavanda", swatch: ["#e8dcf2", "#c9a0dc", "#9b72cf"] },
  { key: "peach", label: "Melocotón", swatch: ["#fde2cf", "#f8c5a0", "#e89770"] },
  { key: "mint", label: "Menta", swatch: ["#d6f0e0", "#a8d8c0", "#6db89a"] },
  { key: "sky", label: "Cielo", swatch: ["#d8e6f5", "#a8c5e8", "#6b8fc4"] },
];

export type CustomColors = {
  primary: string;
  accent: string;
  blush: string;
  lavender: string;
};

export type Preferences = {
  themeKey: ThemeKey;
  myName: string;
  partnerName: string;
  emoji: string;
  customEnabled: boolean;
  customColors: CustomColors;
};

const PREFS_KEY = "rincon:prefs";

export const DEFAULT_CUSTOM_COLORS: CustomColors = {
  primary: "#d48bb0",
  accent: "#f8d7c4",
  blush: "#fbe1ea",
  lavender: "#e7d8f2",
};

const DEFAULT_PREFS: Preferences = {
  themeKey: "blush",
  myName: "",
  partnerName: "",
  emoji: "💕",
  customEnabled: false,
  customColors: DEFAULT_CUSTOM_COLORS,
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

const CUSTOM_VARS: (keyof CustomColors)[] = ["primary", "accent", "blush", "lavender"];

function applyCustomColors(colors: CustomColors | null) {
  if (typeof document === "undefined") return;
  const style = document.documentElement.style;
  if (!colors) {
    for (const k of CUSTOM_VARS) style.removeProperty(`--${k}`);
    style.removeProperty(`--ring`);
    return;
  }
  style.setProperty("--primary", colors.primary);
  style.setProperty("--accent", colors.accent);
  style.setProperty("--blush", colors.blush);
  style.setProperty("--lavender", colors.lavender);
  style.setProperty("--ring", colors.primary);
}

function applyTheme(themeKey: ThemeKey) {
  if (typeof document === "undefined") return;
  const cls = document.documentElement.classList;
  for (const c of Array.from(cls)) {
    if (c.startsWith("theme-")) cls.remove(c);
  }
  cls.add(`theme-${themeKey}`);
}

function applyPrefs(p: Preferences) {
  applyTheme(p.themeKey);
  applyCustomColors(p.customEnabled ? p.customColors : null);
}

export function usePreferences() {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const p = readPrefs();
    setPrefs(p);
    applyPrefs(p);
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
      applyPrefs(next);
      return next;
    });
  };

  return { prefs, update, hydrated };
}

/** Apply persisted theme on first render anywhere in the app. */
export function useApplyTheme() {
  useEffect(() => {
    applyPrefs(readPrefs());
  }, []);
}

