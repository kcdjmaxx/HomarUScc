# Dashboard Theming

**Language:** TypeScript (React 19)
**Environment:** Browser (Vite-bundled SPA)

## Overview

Add a global dark/light theme system to the HomarUScc dashboard. Currently all components use hard-coded hex colors in inline styles. This feature extracts colors into a theme system with two palettes (dark and light) and a toggle to switch between them.

## Requirements

1. Define dark and light color palettes with semantic names (bg, surface, border, text, textMuted, accent, success, warning, error, buttonBg, buttonText)
2. Create a ThemeProvider React context that wraps the entire app
3. Create a useTheme() hook that returns the current palette and a toggle function
4. Store theme preference in localStorage; restore on page load
5. Default to dark theme for first-time users (preserves current behavior)
6. Add a theme toggle button in the sidebar footer
7. Update ALL existing components to use theme colors instead of hard-coded hex values:
   - App.tsx (container, hamburger, backdrop)
   - Sidebar.tsx (nav, brand, menu items, status dot)
   - Chat.tsx (messages, bubbles, input area)
   - EventLog.tsx (events, badges, payload)
   - StatusPanel.tsx (cards, sections, channels, memory)
   - MemoryBrowser.tsx (search bar, results)
   - KanbanView.tsx (columns, cards, forms)
   - CrmView.tsx (contacts, detail view, forms, chat)
   - AppsView.tsx (app cards, app renderer)
   - SpacesView.tsx (buckets, items, forms, chat)
8. No CSS files or CSS modules -- maintain inline styles convention
9. No external dependencies -- React 19 only
10. Theme toggle must be visible and accessible
