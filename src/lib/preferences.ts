import { useEffect, useState } from "react";

export type ThemeKey = "blush" | "lavender" | "peach" | "mint" | "sky";

export const THEMES: {
  key: ThemeKey;
  label: string;
  swatch: string[];
  unlockAt: number;
  hint: string;
}[] = [
  { key: "blush", label: "Rosa", swatch: ["#f8d7e0", "#e8c5d0", "#c98aa6"], unlockAt: 0, hint: "Siempre disponible" },
  { key: "peach", label: "Melocotón", swatch: ["#fde2cf", "#f8c5a0", "#e89770"], unlockAt: 3, hint: "Racha de 3 días" },
  { key: "mint", label: "Menta", swatch: ["#d6f0e0", "#a8d8c0", "#6db89a"], unlockAt: 7, hint: "Racha de 7 días" },
  { key: "lavender", label: "Lavanda", swatch: ["#e8dcf2", "#c9a0dc", "#9b72cf"], unlockAt: 14, hint: "Racha de 14 días" },
  { key: "sky", label: "Cielo", swatch: ["#d8e6f5", "#a8c5e8", "#6b8fc4"], unlockAt: 30, hint: "Racha de 30 días" },
];

export type CustomColors = {
  primary: string;
  accent: string;
  background: string;
  foreground: string;
  card: string;
  border: string;
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
  background: "#fdf6f9",
  foreground: "#3b2733",
  card: "#ffffff",
  border: "#f0dbe4",
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
    const parsed = JSON.parse(raw) as Partial<Preferences>;
    return {
      ...DEFAULT_PREFS,
      ...parsed,
      customColors: { ...DEFAULT_CUSTOM_COLORS, ...(parsed.customColors ?? {}) },
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

const CUSTOM_KEYS = [
  "primary",
  "accent",
  "background",
  "foreground",
  "card",
  "border",
  "blush",
  "lavender",
] as const;

// Derived tokens we also set/unset so nothing stays stale
const DERIVED_KEYS = [
  "ring",
  "primary-foreground",
  "accent-foreground",
  "card-foreground",
  "popover",
  "popover-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "input",
  "sidebar",
  "sidebar-foreground",
  "sidebar-primary",
  "sidebar-primary-foreground",
  "sidebar-accent",
  "sidebar-accent-foreground",
  "sidebar-border",
  "sidebar-ring",
] as const;

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastOn(hex: string): string {
  return luminance(hex) > 0.55 ? "#2a1f28" : "#ffffff";
}

function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const bl = Math.round(b1 + (b2 - b1) * t);
  return `#${[r, g, bl].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function applyCustomColors(colors: CustomColors | null) {
  if (typeof document === "undefined") return;
  const style = document.documentElement.style;
  if (!colors) {
    for (const k of CUSTOM_KEYS) style.removeProperty(`--${k}`);
    for (const k of DERIVED_KEYS) style.removeProperty(`--${k}`);
    return;
  }

  for (const k of CUSTOM_KEYS) style.setProperty(`--${k}`, colors[k]);

  const onPrimary = contrastOn(colors.primary);
  const onAccent = contrastOn(colors.accent);
  const onCard = contrastOn(colors.card);
  const muted = mix(colors.background, colors.foreground, 0.06);
  const mutedFg = mix(colors.foreground, colors.background, 0.45);
  const secondary = mix(colors.accent, colors.background, 0.45);

  style.setProperty("--ring", colors.primary);
  style.setProperty("--primary-foreground", onPrimary);
  style.setProperty("--accent-foreground", onAccent);
  style.setProperty("--card-foreground", onCard);
  style.setProperty("--popover", colors.card);
  style.setProperty("--popover-foreground", onCard);
  style.setProperty("--secondary", secondary);
  style.setProperty("--secondary-foreground", colors.foreground);
  style.setProperty("--muted", muted);
  style.setProperty("--muted-foreground", mutedFg);
  style.setProperty("--input", colors.border);
  style.setProperty("--sidebar", colors.card);
  style.setProperty("--sidebar-foreground", colors.foreground);
  style.setProperty("--sidebar-primary", colors.primary);
  style.setProperty("--sidebar-primary-foreground", onPrimary);
  style.setProperty("--sidebar-accent", colors.accent);
  style.setProperty("--sidebar-accent-foreground", onAccent);
  style.setProperty("--sidebar-border", colors.border);
  style.setProperty("--sidebar-ring", colors.primary);
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
