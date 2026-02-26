// CRC: crc-ThemeProvider.md | Seq: seq-theme-toggle.md
import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

// R350: Semantic color palette
export interface ThemePalette {
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  borderSubtle: string;
  text: string;
  textMuted: string;
  textFaint: string;
  accent: string;
  accentSubtle: string;
  success: string;
  successSubtle: string;
  warning: string;
  warningSubtle: string;
  error: string;
  errorSubtle: string;
  buttonBg: string;
  buttonText: string;
  inputBg: string;
  inputBorder: string;
  overlay: string;
  userBubbleBg: string;
  userBubbleBorder: string;
  shadow: string;
}

// R350: Dark palette (current dashboard colors)
const darkPalette: ThemePalette = {
  bg: "#0a0a0f",
  surface: "#12121a",
  surfaceAlt: "#14141e",
  border: "#1e1e2e",
  borderSubtle: "#1a1a24",
  text: "#e0e0e8",
  textMuted: "#8888a0",
  textFaint: "#555568",
  accent: "#c4b5fd",
  accentSubtle: "#7c3aed",
  success: "#4ade80",
  successSubtle: "#1a2e1a",
  warning: "#f59e0b",
  warningSubtle: "#2e2a1a",
  error: "#f87171",
  errorSubtle: "#4a1a1a",
  buttonBg: "#7c3aed",
  buttonText: "#ffffff",
  inputBg: "#1a1a24",
  inputBorder: "#2e2e3e",
  overlay: "rgba(0,0,0,0.5)",
  userBubbleBg: "#2e1065",
  userBubbleBorder: "#7c3aed",
  shadow: "rgba(0,0,0,0.5)",
};

// R350: Light palette
const lightPalette: ThemePalette = {
  bg: "#f8f9fa",
  surface: "#ffffff",
  surfaceAlt: "#f3f4f6",
  border: "#e2e4e9",
  borderSubtle: "#eef0f3",
  text: "#1f2937",
  textMuted: "#6b7280",
  textFaint: "#9ca3af",
  accent: "#7c3aed",
  accentSubtle: "#ede9fe",
  success: "#16a34a",
  successSubtle: "#f0fdf4",
  warning: "#d97706",
  warningSubtle: "#fffbeb",
  error: "#dc2626",
  errorSubtle: "#fef2f2",
  buttonBg: "#7c3aed",
  buttonText: "#ffffff",
  inputBg: "#ffffff",
  inputBorder: "#d1d5db",
  overlay: "rgba(0,0,0,0.3)",
  userBubbleBg: "#ede9fe",
  userBubbleBorder: "#7c3aed",
  shadow: "rgba(0,0,0,0.1)",
};

type ThemeMode = "dark" | "light";

interface ThemeContextValue {
  theme: ThemePalette;
  isDark: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: darkPalette,
  isDark: true,
  toggleTheme: () => {},
});

// R353: localStorage key
const STORAGE_KEY = "homaruscc-theme";

// R369: Set CSS custom properties on document for edge cases
function applyCssVars(palette: ThemePalette): void {
  const root = document.documentElement;
  root.style.setProperty("--hom-bg", palette.bg);
  root.style.setProperty("--hom-surface", palette.surface);
  root.style.setProperty("--hom-border", palette.border);
  root.style.setProperty("--hom-text", palette.text);
  root.style.setProperty("--hom-text-muted", palette.textMuted);
  root.style.setProperty("--hom-accent", palette.accent);
  root.style.setProperty("--hom-input-bg", palette.inputBg);
  root.style.setProperty("--hom-input-border", palette.inputBorder);
  // Prevent white bleed on html/body
  root.style.background = palette.bg;
  root.style.margin = "0";
  document.body.style.background = palette.bg;
  document.body.style.margin = "0";
}

// R351: ThemeProvider wraps the entire app
export function ThemeProvider({ children }: { children: ReactNode }) {
  // R354: Default to dark when no localStorage value exists
  const [mode, setMode] = useState<ThemeMode>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "light" ? "light" : "dark";
  });

  const palette = mode === "dark" ? darkPalette : lightPalette;

  useEffect(() => {
    applyCssVars(palette);
  }, [palette]);

  // R352: toggleTheme switches and persists
  const toggleTheme = () => {
    setMode((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ theme: palette, isDark: mode === "dark", toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

// R352: useTheme hook
export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
