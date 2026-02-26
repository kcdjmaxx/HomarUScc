# Spaces: Organizational Workspace

**Language:** TypeScript
**Environment:** Node.js backend (Express), React 19 frontend (Vite)

## Overview

Spaces is a Notion-like organizational workspace that lives in the HomarUScc dashboard. It stores data as markdown files with YAML frontmatter inside the Obsidian vault, providing a general-purpose organizational workspace for categorizing heterogeneous items (ideas, lists, checklists, reference links, project buckets) with hierarchical nesting.

## Data Model

### Buckets

A bucket is a user-defined container for related items, stored as a directory on disk. Each bucket directory contains a `_bucket.md` file with YAML frontmatter defining: id, name, description, statuses (default: `["open", "done"]`), color, sortOrder, and custom property definitions. Buckets can nest (sub-directories) with no depth limit in data but UI capped at 3 levels.

### Items

An item is a markdown file with YAML frontmatter containing: id, status, priority (0-3), tags, due date (optional ISO), assignee (optional, "max" or "caul"), createdBy, created, updated, and custom properties. The file's `# heading` is the title. Body content is markdown, supporting interactive checklists.

### Root Config

`_root.md` at the spaces directory root holds global config and top-level bucket sort order.

## Storage

Directory-based storage at a configurable path (default: `{vault}/Spaces/`). Configurable via `~/.homaruscc/config.json` under `spaces.path`. The vault root is derived by going up from the project CWD (`ClawdBot/homaruscc/`).

Default buckets pre-seeded on first run: Fric & Frac (with sub-buckets: Marketing, Staffing, Menu, Operations), Miami Ice, Personal, Projects (with sub-buckets: HomarUScc, TED Talk).

## Backend

Add a SpacesManager class that loads the full directory tree into an in-memory cache on startup, watches for external changes (Obsidian edits) via chokidar, and invalidates cache on file modification. Writes go to disk first (write-to-temp-then-rename for atomicity), then update the cache.

### API Routes (in dashboard-server.ts)

- `GET /api/spaces/tree` -- full nested tree of buckets + items
- `POST /api/spaces/buckets` -- create bucket
- `PATCH /api/spaces/buckets/:id` -- update bucket metadata
- `DELETE /api/spaces/buckets/:id` -- delete bucket + contents
- `POST /api/spaces/buckets/:id/items` -- create item in bucket
- `PATCH /api/spaces/items/:id` -- update item
- `DELETE /api/spaces/items/:id` -- delete item
- `POST /api/spaces/items/:id/move` -- move item to different bucket
- `GET /api/spaces/search?q=...` -- full-text search

## Frontend

Single-file component `SpacesView.tsx` following CrmView.tsx patterns. Receives `messages` and `send` props for WebSocket chat integration.

### List View (default)

Buckets displayed as a collapsible tree with indented sub-buckets. Items show title, status chip (clickable, cycles through bucket statuses), priority indicator, due date (highlighted red if overdue, amber if within 2 days), and assignee. Collapsible sections.

### Quick Add

Type title + Enter to add item. Optional expansion for body, tags, priority, due date, assignee, custom properties.

### Search

Global search bar filters items across all buckets by title, body, tags, property values.

### Inline Edit

Click item title to edit inline. Click body to expand/edit. No modals for simple edits.

### Delete

Items: immediate delete (no confirmation). Buckets: confirmation step (click twice).

### Interactive Checklists

Markdown checkboxes rendered as interactive elements. Toggling updates the markdown file on disk.

### Chat Panel

"Chat with Caul" panel scoped to current bucket context, reusing the CrmChat pattern.

## MCP Tools

- `spaces_list_buckets` -- list all buckets with item counts
- `spaces_get_bucket` -- get bucket details + items
- `spaces_create_bucket` -- create bucket (optionally nested)
- `spaces_add_item` -- add item to bucket
- `spaces_update_item` -- update existing item
- `spaces_search` -- search across all buckets

## Styling

Inline styles only. Dark theme palette: `#0a0a0f` bg, `#12121a` cards, `#1e1e2e` borders, `#c4b5fd` accent, `#8888a0` muted. Monospace font inherited. No CSS framework, no external dependencies.

## Sidebar

New View type `"spaces"` in App.tsx and Sidebar.tsx. Icon `%`, label "Spaces". Placed after "People" (crm) and before "Apps".
