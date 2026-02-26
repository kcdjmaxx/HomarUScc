# ThemeProvider
**Requirements:** R350, R351, R352, R353, R354, R355, R366, R367, R368, R369

## Knows
- darkPalette: ThemePalette with semantic color names (bg, surface, border, text, textMuted, accent, success, warning, error, buttonBg, buttonText, inputBg, inputBorder)
- lightPalette: ThemePalette with equivalent light-mode colors
- STORAGE_KEY: "homaruscc-theme" localStorage key
- ThemeContext: React context holding current palette and toggleTheme function

## Does
- ThemeProvider(children): Wraps app in context; reads localStorage on mount, defaults to dark; sets CSS custom properties on documentElement
- useTheme(): Hook returning { theme: ThemePalette, isDark: boolean, toggleTheme: () => void }
- toggleTheme(): Switches between dark/light, persists to localStorage, updates CSS custom properties
- applyCssVars(palette): Sets --hom-bg, --hom-surface, etc. on document.documentElement for edge cases

## Collaborators
- App.tsx: Wraps entire app in ThemeProvider
- Sidebar.tsx: Uses useTheme() for nav colors and renders toggle button
- All view components: Use useTheme() to get current palette for inline styles

## Sequences
- seq-theme-toggle.md
