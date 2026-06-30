import { useEffect, useState } from "react";

export type ThemeKey = "blush" | "lavender" | "peach" | "mint" | "sky" | "dark-rose" | "custom";

export const THEMES: { key: ThemeKey; label: string; swatch: string[] }[] = [
  { key: "blush",     label: "Rosa",       swatch: ["#f8d7e0", "#e8c5d0", "#c98aa6"] },
  { key: "lavender",  label: "Lavanda",    swatch: ["#e8dcf2", "#c9a0dc", "#9b72cf"] },
  { key: "peach",     label: "Melocotón",  swatch: ["#fde2cf", "#f8c5a0", "#e89770"] },
  { key: "mint",      label: "Menta",      swatch: ["#d6f0e0", "#a8d8c0", "#6db89a"] },
  { key: "sky",       label: "Cielo",      swatch: ["#d8e6f5", "#a8c5e8", "#6b8fc4"] },
  { key: "dark-rose", label: "Rosa Oscuro",swatch: ["#1a0a0f", "#3d1a2b", "#c9607a"] },
];

export type CustomColors = {
  background: string;
  card: string;
  primary: string;
  accent: string;
  foreground: string;
  border: string;
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
  background: "#fff0f5",
  card: "#fff8fb",
  primary: "#d48bb0",
  accent: "#f8d7c4",
  foreground: "#4a1a2e",
  border: "#f0c0d8",
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

// Convierte hex #rrggbb a oklch aproximado para compatibilidad con el CSS
function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return [r, g, b];
}

// Aplica los colores directamente como rgb() para máxima compatibilidad
function applyCustomColors(colors: CustomColors) {
  if (typeof document === "undefined") return;
  const s = document.documentElement.style;
  const [br, bg, bb] = hexToRgb(colors.background);
  const [cr, cg, cb] = hexToRgb(colors.card);
  const [pr, pg, pb] = hexToRgb(colors.primary);
  const [ar, ag, ab] = hexToRgb(colors.accent);
  const [fr, fg, fb] = hexToRgb(colors.foreground);
  const [bor, bog, bob] = hexToRgb(colors.border);

  s.setProperty("--background", `rgb(${Math.round(br*255)} ${Math.round(bg*255)} ${Math.round(bb*255)})`);
  s.setProperty("--card",       `rgb(${Math.round(cr*255)} ${Math.round(cg*255)} ${Math.round(cb*255)})`);
  s.setProperty("--popover",    `rgb(${Math.round(cr*255)} ${Math.round(cg*255)} ${Math.round(cb*255)})`);
  s.setProperty("--primary",    `rgb(${Math.round(pr*255)} ${Math.round(pg*255)} ${Math.round(pb*255)})`);
  s.setProperty("--primary-foreground", "rgb(255 255 255)");
  s.setProperty("--accent",     `rgb(${Math.round(ar*255)} ${Math.round(ag*255)} ${Math.round(ab*255)})`);
  s.setProperty("--accent-foreground", `rgb(${Math.round(fr*255)} ${Math.round(fg*255)} ${Math.round(fb*255)})`);
  s.setProperty("--foreground",        `rgb(${Math.round(fr*255)} ${Math.round(fg*255)} ${Math.round(fb*255)})`);
  s.setProperty("--card-foreground",   `rgb(${Math.round(fr*255)} ${Math.round(fg*255)} ${Math.round(fb*255)})`);
  s.setProperty("--popover-foreground",`rgb(${Math.round(fr*255)} ${Math.round(fg*255)} ${Math.round(fb*255)})`);
  s.setProperty("--border",  `rgb(${Math.round(bor*255)} ${Math.round(bog*255)} ${Math.round(bob*255)})`);
  s.setProperty("--input",   `rgb(${Math.round(bor*255)} ${Math.round(bog*255)} ${Math.round(bob*255)})`);
  s.setProperty("--ring",    `rgb(${Math.round(pr*255)} ${Math.round(pg*255)} ${Math.round(pb*255)})`);
  s.setProperty("--muted",   `rgb(${Math.round(cr*255)} ${Math.round(cg*255)} ${Math.round(cb*255)})`);
  s.setProperty("--muted-foreground", `rgb(${Math.round(fr*255)} ${Math.round(fg*255)} ${Math.round(fb*255)})`);
  s.setProperty("--secondary", `rgb(${Math.round(ar*255)} ${Math.round(ag*255)} ${Math.round(ab*255)})`);
  s.setProperty("--secondary-foreground", `rgb(${Math.round(fr*255)} ${Math.round(fg*255)} ${Math.round(fb*255)})`);
  // Blush y lavender como variantes del background/accent
  s.setProperty("--blush",    `rgb(${Math.round(br*255)} ${Math.round(bg*255)} ${Math.round(bb*255)})`);
  s.setProperty("--lavender", `rgb(${Math.round(ar*255)} ${Math.round(ag*255)} ${Math.round(ab*255)})`);
  // Sidebar igual que card
  s.setProperty("--sidebar",                `rgb(${Math.round(cr*255)} ${Math.round(cg*255)} ${Math.round(cb*255)})`);
  s.setProperty("--sidebar-foreground",     `rgb(${Math.round(fr*255)} ${Math.round(fg*255)} ${Math.round(fb*255)})`);
  s.setProperty("--sidebar-primary",        `rgb(${Math.round(pr*255)} ${Math.round(pg*255)} ${Math.round(pb*255)})`);
  s.setProperty("--sidebar-primary-foreground", "rgb(255 255 255)");
  s.setProperty("--sidebar-accent",         `rgb(${Math.round(ar*255)} ${Math.round(ag*255)} ${Math.round(ab*255)})`);
  s.setProperty("--sidebar-border",         `rgb(${Math.round(bor*255)} ${Math.round(bog*255)} ${Math.round(bob*255)})`);
}

function clearCustomColors() {
  if (typeof document === "undefined") return;
  const s = document.documentElement.style;
  const vars = [
    "--background","--card","--popover","--primary","--primary-foreground",
    "--accent","--accent-foreground","--foreground","--card-foreground",
    "--popover-foreground","--border","--input","--ring","--muted",
    "--muted-foreground","--secondary","--secondary-foreground",
    "--blush","--lavender","--sidebar","--sidebar-foreground",
    "--sidebar-primary","--sidebar-primary-foreground","--sidebar-accent",
    "--sidebar-border",
  ];
  for (const v of vars) s.removeProperty(v);
}

function applyTheme(themeKey: ThemeKey) {
  if (typeof document === "undefined") return;
  const cls = document.documentElement.classList;
  for (const c of Array.from(cls)) {
    if (c.startsWith("theme-")) cls.remove(c);
  }
  if (themeKey !== "custom") cls.add(`theme-${themeKey}`);
}

function applyPrefs(p: Preferences) {
  applyTheme(p.themeKey);
  if (p.customEnabled) {
    applyCustomColors(p.customColors);
  } else {
    clearCustomColors();
  }
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
      } catch { /* noop */ }
      applyPrefs(next);
      return next;
    });
  };

  return { prefs, update, hydrated };
}

export function useApplyTheme() {
  useEffect(() => {
    applyPrefs(readPrefs());
  }, []);
}
