// CRC: crc-SpacesView.md | CRC: crc-ThemeProvider.md | Seq: seq-spaces-crud.md
import { useState, useEffect, useCallback, useRef } from "react";
import { useTheme, type ThemePalette } from "../theme";
import { registerSkill, type ViewProps } from "../skills-registry";

interface WsMessage {
  type: string;
  payload: unknown;
}

interface SpacesViewProps {
  messages: WsMessage[];
  send: (type: string, payload: Record<string, unknown>) => void;
}

// R330: Property definitions
interface PropertyDef {
  key: string;
  type: "text" | "url" | "number" | "date" | "select";
  label: string;
  options?: string[];
}

// R301: Bucket metadata
interface BucketMeta {
  id: string;
  name: string;
  description?: string;
  statuses: string[];
  color?: string;
  sortOrder: number;
  properties: PropertyDef[];
  created: string;
  updated: string;
}

// R302: Item data
interface SpaceItem {
  id: string;
  title: string;
  body: string;
  status: string;
  priority: number;
  tags: string[];
  due?: string;
  assignee?: string;
  createdBy: string;
  created: string;
  updated: string;
  sortOrder: number;
  properties: Record<string, unknown>;
}

interface SpaceBucket {
  meta: BucketMeta;
  items: SpaceItem[];
  children: SpaceBucket[];
  path: string;
}

interface SpaceTree {
  buckets: SpaceBucket[];
}

const API = "/api/spaces";

// R365: SpacesView with theme colors
export function SpacesView({ messages, send }: SpacesViewProps) {
  const { theme, isDark } = useTheme();

  const PRIORITY_LABELS: Record<number, { label: string; color: string; bg: string; border: string }> = {
    0: { label: "---", color: theme.textFaint, bg: "transparent", border: theme.inputBorder },
    1: { label: "low", color: theme.success, bg: isDark ? "#1a2e1a" : "#f0fdf4", border: theme.success },
    2: { label: "med", color: theme.warning, bg: isDark ? "#2e2a1a" : "#fffbeb", border: theme.warning },
    3: { label: "high", color: theme.error, bg: isDark ? "#2e1a1a" : "#fef2f2", border: theme.error },
  };

  const [tree, setTree] = useState<SpaceTree>({ buckets: [] });
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [quickAdd, setQuickAdd] = useState<{ bucketId: string } | null>(null);
  const [quickAddTitle, setQuickAddTitle] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [showNewBucket, setShowNewBucket] = useState(false);
  const [newBucketName, setNewBucketName] = useState("");
  const [newBucketParent, setNewBucketParent] = useState("");
  const [newBucketColor, setNewBucketColor] = useState("");

  // R310: Fetch tree
  const fetchTree = useCallback(async () => {
    try {
      const res = await fetch(`${API}/tree`);
      const data = await res.json();
      setTree(data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchTree();
    const interval = setInterval(fetchTree, 10_000);
    return () => clearInterval(interval);
  }, [fetchTree]);

  // R323: Quick add
  const handleQuickAdd = async (bucketId: string) => {
    if (!quickAddTitle.trim()) return;
    try {
      await fetch(`${API}/buckets/${bucketId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: quickAddTitle, createdBy: "max" }),
      });
      setQuickAddTitle("");
      setQuickAdd(null);
      fetchTree();
    } catch { /* ignore */ }
  };

  // R321: Cycle status
  const cycleStatus = async (item: SpaceItem, statuses: string[]) => {
    const idx = statuses.indexOf(item.status);
    const next = statuses[(idx + 1) % statuses.length];
    try {
      await fetch(`${API}/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      fetchTree();
    } catch { /* ignore */ }
  };

  const cyclePriority = async (item: SpaceItem) => {
    const next = (item.priority + 1) % 4;
    try {
      await fetch(`${API}/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority: next }),
      });
      fetchTree();
    } catch { /* ignore */ }
  };

  // R325: Inline edit
  const startEdit = (item: SpaceItem) => {
    setEditingItem(item.id);
    setEditTitle(item.title);
    setEditBody(item.body);
  };

  const saveEdit = async () => {
    if (!editingItem) return;
    try {
      await fetch(`${API}/items/${editingItem}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle, body: editBody }),
      });
      setEditingItem(null);
      fetchTree();
    } catch { /* ignore */ }
  };

  const reorderItem = async (id: string, direction: "up" | "down") => {
    try {
      await fetch(`${API}/items/${id}/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction }),
      });
      fetchTree();
    } catch { /* ignore */ }
  };

  // R316: Delete item
  const deleteItem = async (id: string) => {
    try {
      await fetch(`${API}/items/${id}`, { method: "DELETE" });
      fetchTree();
    } catch { /* ignore */ }
  };

  // R313: Delete bucket (R326: two-click confirm)
  const deleteBucket = async (id: string) => {
    if (confirmDelete === id) {
      try {
        await fetch(`${API}/buckets/${id}`, { method: "DELETE" });
        setConfirmDelete(null);
        fetchTree();
      } catch { /* ignore */ }
    } else {
      setConfirmDelete(id);
      setTimeout(() => setConfirmDelete(null), 3000);
    }
  };

  // R327: Toggle checkbox in item body
  const toggleCheckbox = async (item: SpaceItem, lineIndex: number) => {
    const lines = item.body.split("\n");
    let checkboxCount = 0;
    for (let i = 0; i < lines.length; i++) {
      const unchecked = lines[i].match(/^(\s*-\s)\[ \]/);
      const checked = lines[i].match(/^(\s*-\s)\[x\]/);
      if (unchecked || checked) {
        if (checkboxCount === lineIndex) {
          if (unchecked) {
            lines[i] = lines[i].replace("[ ]", "[x]");
          } else {
            lines[i] = lines[i].replace("[x]", "[ ]");
          }
          break;
        }
        checkboxCount++;
      }
    }
    try {
      await fetch(`${API}/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: lines.join("\n") }),
      });
      fetchTree();
    } catch { /* ignore */ }
  };

  const createBucket = async () => {
    if (!newBucketName.trim()) return;
    try {
      await fetch(`${API}/buckets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newBucketName,
          parentId: newBucketParent || undefined,
          color: newBucketColor || undefined,
        }),
      });
      setNewBucketName("");
      setNewBucketParent("");
      setNewBucketColor("");
      setShowNewBucket(false);
      fetchTree();
    } catch { /* ignore */ }
  };

  const toggleCollapse = (id: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // R324: Filter by search
  const matchesSearch = (item: SpaceItem): boolean => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.body.toLowerCase().includes(q) ||
      item.tags.some(t => t.toLowerCase().includes(q)) ||
      Object.values(item.properties).some(v => String(v).toLowerCase().includes(q))
    );
  };

  const bucketHasMatches = (bucket: SpaceBucket): boolean => {
    if (!search) return true;
    return (
      bucket.items.some(matchesSearch) ||
      bucket.children.some(bucketHasMatches)
    );
  };

  const allBuckets: Array<{ id: string; name: string; depth: number }> = [];
  const collectBuckets = (buckets: SpaceBucket[], depth: number) => {
    for (const b of buckets) {
      allBuckets.push({ id: b.meta.id, name: b.meta.name, depth });
      collectBuckets(b.children, depth + 1);
    }
  };
  collectBuckets(tree.buckets, 0);

  // R322: Due date formatting
  const formatDue = (due: string): { text: string; style: React.CSSProperties } => {
    const now = new Date();
    const dueDate = new Date(due);
    const diffMs = dueDate.getTime() - now.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffDays < 0) {
      return { text: due, style: { color: theme.error, fontWeight: 600 } };
    } else if (diffDays <= 2) {
      return { text: due, style: { color: theme.warning, fontWeight: 600 } };
    }
    return { text: due, style: { color: theme.textMuted } };
  };

  // R327: Render markdown body with interactive checkboxes
  const renderBody = (item: SpaceItem) => {
    if (!item.body) return null;
    const lines = item.body.split("\n");
    let checkboxIndex = 0;

    return (
      <div style={{ padding: "8px 12px", background: theme.bg, borderRadius: 6, margin: "0 0 4px 0" }}>
        {lines.map((line, i) => {
          const unchecked = line.match(/^(\s*)-\s\[ \]\s(.+)$/);
          const checked = line.match(/^(\s*)-\s\[x\]\s(.+)$/);

          if (unchecked) {
            const idx = checkboxIndex++;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: "2px 0" }}>
                <button
                  style={{ background: "none", border: "none", color: theme.accent, fontSize: 14, cursor: "pointer", fontFamily: "inherit", padding: 0 }}
                  onClick={() => toggleCheckbox(item, idx)}
                >
                  &#9744;
                </button>
                <span style={{ color: theme.text, fontSize: 12 }}>{unchecked[2]}</span>
              </div>
            );
          }
          if (checked) {
            const idx = checkboxIndex++;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: "2px 0" }}>
                <button
                  style={{ background: "none", border: "none", color: theme.accent, fontSize: 14, cursor: "pointer", fontFamily: "inherit", padding: 0 }}
                  onClick={() => toggleCheckbox(item, idx)}
                >
                  &#9745;
                </button>
                <span style={{ color: theme.textMuted, fontSize: 12, textDecoration: "line-through" }}>{checked[2]}</span>
              </div>
            );
          }

          if (line.startsWith("## ")) {
            return <div key={i} style={{ color: theme.text, fontWeight: 600, fontSize: 13, marginTop: 8 }}>{line.slice(3)}</div>;
          }
          if (line.startsWith("### ")) {
            return <div key={i} style={{ color: theme.text, fontWeight: 600, fontSize: 12, marginTop: 6 }}>{line.slice(4)}</div>;
          }
          if (line.trim() === "") return <div key={i} style={{ height: 4 }} />;
          return <div key={i} style={{ color: theme.text, fontSize: 12, lineHeight: 1.5 }}>{line}</div>;
        })}
      </div>
    );
  };

  // R320: Render bucket tree recursively
  const renderBucket = (bucket: SpaceBucket, depth: number) => {
    if (depth >= 3) return null;
    if (search && !bucketHasMatches(bucket)) return null;

    const isCollapsed = collapsed.has(bucket.meta.id);
    const items = search ? bucket.items.filter(matchesSearch) : bucket.items;
    const totalItems = countItems(bucket);
    const isQuickAdding = quickAdd?.bucketId === bucket.meta.id;

    return (
      <div key={bucket.meta.id} style={{ marginLeft: depth * 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 4px", borderBottom: `1px solid ${theme.border}` }}>
          <button
            style={{ background: "none", border: "none", color: theme.textMuted, fontSize: 10, cursor: "pointer", fontFamily: "inherit", padding: "2px 4px", width: 20, textAlign: "center" as const }}
            onClick={() => toggleCollapse(bucket.meta.id)}
          >
            {isCollapsed ? "\u25B6" : "\u25BC"}
          </button>
          {bucket.meta.color && (
            <span style={{ width: 8, height: 8, borderRadius: "50%", display: "inline-block", flexShrink: 0, background: bucket.meta.color }} />
          )}
          <span style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>{bucket.meta.name}</span>
          <span style={{ fontSize: 11, color: theme.textMuted }}>({totalItems})</span>
          <button
            style={{ marginLeft: "auto", background: "none", border: `1px solid ${theme.inputBorder}`, borderRadius: 4, color: theme.accent, cursor: "pointer", fontSize: 12, padding: "1px 8px", fontFamily: "inherit", fontWeight: 600 }}
            onClick={() => { setQuickAdd({ bucketId: bucket.meta.id }); setQuickAddTitle(""); }}
          >
            +
          </button>
          <button
            style={confirmDelete === bucket.meta.id
              ? { background: theme.errorSubtle, border: `1px solid ${theme.error}`, borderRadius: 4, color: theme.error, cursor: "pointer", fontSize: 10, fontFamily: "inherit", padding: "2px 8px" }
              : { background: "none", border: "none", color: theme.textFaint, cursor: "pointer", fontSize: 14, fontFamily: "inherit", padding: "0 4px" }}
            onClick={() => deleteBucket(bucket.meta.id)}
          >
            {confirmDelete === bucket.meta.id ? "confirm?" : "\u00D7"}
          </button>
        </div>

        {isQuickAdding && !isCollapsed && (
          <div style={{ display: "flex", gap: 8, padding: "6px 0", marginLeft: 24 }}>
            <input
              style={{ flex: 1, background: theme.bg, border: `1px solid ${theme.inputBorder}`, borderRadius: 6, color: theme.text, padding: "6px 10px", fontSize: 12, fontFamily: "inherit", outline: "none" }}
              placeholder="Add item..."
              value={quickAddTitle}
              onChange={(e) => setQuickAddTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleQuickAdd(bucket.meta.id);
                if (e.key === "Escape") setQuickAdd(null);
              }}
              autoFocus
            />
          </div>
        )}

        {!isCollapsed && items.map(item => renderItem(item, bucket))}
        {!isCollapsed && bucket.children.map(child => renderBucket(child, depth + 1))}
      </div>
    );
  };

  const countItems = (bucket: SpaceBucket): number => {
    return bucket.items.length + bucket.children.reduce((acc, c) => acc + countItems(c), 0);
  };

  // R320: Render item row
  const renderItem = (item: SpaceItem, bucket: SpaceBucket) => {
    const isEditing = editingItem === item.id;
    const isExpanded = expandedItem === item.id;
    const priority = PRIORITY_LABELS[item.priority] ?? PRIORITY_LABELS[0];

    if (isEditing) {
      return (
        <div key={item.id} style={{ marginLeft: 24, padding: 8, background: theme.surface, borderRadius: 8, marginBottom: 4, display: "flex", flexDirection: "column" as const, gap: 8 }}>
          <input
            style={{ background: theme.bg, border: `1px solid ${theme.inputBorder}`, borderRadius: 6, color: theme.text, padding: "8px 10px", fontSize: 13, fontFamily: "inherit", outline: "none" }}
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveEdit();
              if (e.key === "Escape") setEditingItem(null);
            }}
            autoFocus
          />
          <textarea
            style={{ background: theme.bg, border: `1px solid ${theme.inputBorder}`, borderRadius: 6, color: theme.text, padding: "8px 10px", fontSize: 12, fontFamily: "inherit", outline: "none", resize: "vertical" as const }}
            value={editBody}
            onChange={(e) => setEditBody(e.target.value)}
            rows={4}
            placeholder="Body (markdown)..."
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button style={{ background: theme.buttonBg, border: "none", borderRadius: 6, color: theme.buttonText, cursor: "pointer", fontSize: 12, padding: "6px 16px", fontFamily: "inherit", fontWeight: 600 }} onClick={saveEdit}>Save</button>
            <button style={{ background: "none", border: `1px solid ${theme.inputBorder}`, borderRadius: 6, color: theme.textMuted, cursor: "pointer", fontSize: 12, padding: "6px 12px", fontFamily: "inherit" }} onClick={() => setEditingItem(null)}>Cancel</button>
          </div>
        </div>
      );
    }

    return (
      <div key={item.id} style={{ marginLeft: 24, borderBottom: `1px solid ${isDark ? "#0f0f18" : theme.borderSubtle}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 4px", minHeight: 32 }}>
          <button
            style={{
              border: "1px solid",
              borderRadius: 4,
              fontSize: 10,
              padding: "2px 8px",
              cursor: "pointer",
              fontFamily: "inherit",
              fontWeight: 500,
              textTransform: "uppercase" as const,
              letterSpacing: 0.5,
              flexShrink: 0,
              background: item.status === "done" ? (isDark ? "#1a2e1a" : "#f0fdf4") : item.status === "doing" ? (isDark ? "#1a1a3e" : "#ede9fe") : theme.border,
              color: item.status === "done" ? theme.success : item.status === "doing" ? theme.accent : theme.textMuted,
              borderColor: item.status === "done" ? theme.success : item.status === "doing" ? theme.accentSubtle : theme.inputBorder,
            }}
            onClick={() => cycleStatus(item, bucket.meta.statuses)}
            title={`Click to cycle status (current: ${item.status})`}
          >
            {item.status}
          </button>

          <button
            style={{
              border: "1px solid",
              borderRadius: 4,
              fontSize: 9,
              padding: "2px 6px",
              cursor: "pointer",
              fontFamily: "inherit",
              fontWeight: 600,
              textTransform: "uppercase" as const,
              letterSpacing: 0.5,
              flexShrink: 0,
              minWidth: 28,
              textAlign: "center" as const,
              background: priority.bg,
              color: priority.color,
              borderColor: priority.border,
            }}
            onClick={() => cyclePriority(item)}
            title={`Priority: ${priority.label} (click to cycle)`}
          >
            {priority.label}
          </button>

          <button
            style={{ background: "none", border: "none", color: theme.text, cursor: "pointer", fontSize: 13, fontFamily: "inherit", textAlign: "left" as const, padding: 0, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}
            onClick={() => startEdit(item)}
            title="Click to edit"
          >
            {item.title}
          </button>

          {item.tags.length > 0 && (
            <span style={{ display: "flex", gap: 4, flexShrink: 0 }}>
              {item.tags.slice(0, 2).map(t => (
                <span key={t} style={{ fontSize: 9, color: theme.textMuted, background: theme.border, borderRadius: 3, padding: "1px 5px" }}>{t}</span>
              ))}
            </span>
          )}

          {item.due && (() => {
            const { text, style } = formatDue(item.due);
            return <span style={{ fontSize: 11, flexShrink: 0, ...style }}>{text}</span>;
          })()}

          {item.assignee && (
            <span style={{
              width: 20, height: 20, borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, fontWeight: 700, flexShrink: 0,
              background: item.assignee === "caul" ? (isDark ? "#1a1a3e" : "#ede9fe") : (isDark ? "#1a2e1a" : "#f0fdf4"),
              color: item.assignee === "caul" ? theme.accent : theme.success,
            }}>
              {item.assignee[0]?.toUpperCase()}
            </span>
          )}

          {item.body && (
            <button
              style={{ background: "none", border: "none", color: theme.textMuted, fontSize: 12, cursor: "pointer", fontFamily: "inherit", padding: "0 4px" }}
              onClick={() => setExpandedItem(isExpanded ? null : item.id)}
            >
              {isExpanded ? "\u25B4" : "\u25BE"}
            </button>
          )}

          <button style={{ background: "none", border: "none", color: theme.textFaint, fontSize: 8, cursor: "pointer", fontFamily: "inherit", padding: "0 2px", flexShrink: 0, lineHeight: 1 }} onClick={() => reorderItem(item.id, "up")} title="Move up">&#9650;</button>
          <button style={{ background: "none", border: "none", color: theme.textFaint, fontSize: 8, cursor: "pointer", fontFamily: "inherit", padding: "0 2px", flexShrink: 0, lineHeight: 1 }} onClick={() => reorderItem(item.id, "down")} title="Move down">&#9660;</button>
          <button style={{ background: "none", border: "none", color: theme.textFaint, fontSize: 14, cursor: "pointer", fontFamily: "inherit", padding: "0 2px", flexShrink: 0 }} onClick={() => deleteItem(item.id)}>&times;</button>
        </div>

        {isExpanded && renderBody(item)}
      </div>
    );
  };

  const inputStyle: React.CSSProperties = {
    background: theme.bg,
    border: `1px solid ${theme.inputBorder}`,
    borderRadius: 6,
    color: theme.text,
    padding: "8px 10px",
    fontSize: 12,
    fontFamily: "inherit",
    outline: "none",
  };

  return (
    <div style={{ padding: 20, height: "100%", overflow: "auto", display: "flex", flexDirection: "column" as const }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: theme.text }}>Spaces</h2>
        <span style={{ fontSize: 12, color: theme.textMuted }}>{allBuckets.length} buckets</span>
        <button style={{ marginLeft: "auto", background: theme.buttonBg, border: "none", borderRadius: 6, color: theme.buttonText, cursor: "pointer", fontSize: 12, padding: "6px 16px", fontFamily: "inherit", fontWeight: 600 }} onClick={() => setShowNewBucket(true)}>+ Bucket</button>
      </div>

      <input
        style={{ ...inputStyle, padding: "10px 14px", fontSize: 13, marginBottom: 16, width: "100%", boxSizing: "border-box" as const, background: theme.surface, borderColor: theme.border }}
        placeholder="Search across all spaces..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {showNewBucket && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", background: theme.surface, borderRadius: 10, padding: 12, marginBottom: 12, flexWrap: "wrap" as const }}>
          <input style={{ ...inputStyle, flex: 1, minWidth: 120 }} placeholder="Bucket name..." value={newBucketName} onChange={(e) => setNewBucketName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") createBucket(); if (e.key === "Escape") setShowNewBucket(false); }} autoFocus />
          <select style={{ ...inputStyle, minWidth: 120 }} value={newBucketParent} onChange={(e) => setNewBucketParent(e.target.value)}>
            <option value="">Top level</option>
            {allBuckets.map(b => (
              <option key={b.id} value={b.id}>{"  ".repeat(b.depth)}{b.name}</option>
            ))}
          </select>
          <input style={{ ...inputStyle, maxWidth: 100 }} placeholder="#color" value={newBucketColor} onChange={(e) => setNewBucketColor(e.target.value)} />
          <button style={{ background: theme.buttonBg, border: "none", borderRadius: 6, color: theme.buttonText, cursor: "pointer", fontSize: 12, padding: "6px 16px", fontFamily: "inherit", fontWeight: 600 }} onClick={createBucket}>Create</button>
          <button style={{ background: "none", border: `1px solid ${theme.inputBorder}`, borderRadius: 6, color: theme.textMuted, cursor: "pointer", fontSize: 12, padding: "6px 12px", fontFamily: "inherit" }} onClick={() => setShowNewBucket(false)}>Cancel</button>
        </div>
      )}

      <div style={{ flex: 1, overflow: "auto" }}>
        {tree.buckets.length === 0 && (
          <div style={{ color: theme.textMuted, fontSize: 13, padding: "40px 0", textAlign: "center" as const }}>No spaces yet. Create a bucket to get started.</div>
        )}
        {tree.buckets.map(bucket => renderBucket(bucket, 0))}
      </div>

      <SpacesChat messages={messages} send={send} context="[Spaces] " placeholder="Chat about your spaces..." theme={theme} isDark={isDark} />
    </div>
  );
}

// R328: Chat panel (reuses CrmChat pattern)
function SpacesChat({ messages, send, context, placeholder, theme }: {
  messages: WsMessage[];
  send: (type: string, payload: Record<string, unknown>) => void;
  context: string;
  placeholder: string;
  theme: ThemePalette;
  isDark?: boolean;
}) {
  const [input, setInput] = useState("");
  const [expanded, setExpanded] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const chatMessages = messages
    .filter((m) => m.type === "chat")
    .map((m) => (m.payload ?? {}) as { from: string; text: string; timestamp: number })
    .slice(-20);

  useEffect(() => {
    if (expanded && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages.length, expanded]);

  const handleSend = () => {
    if (!input.trim()) return;
    send("chat", { text: context + input });
    setInput("");
  };

  if (!expanded) {
    return (
      <button style={{
        position: "sticky" as const, bottom: 0, marginTop: 12,
        background: theme.border, border: `1px solid ${theme.inputBorder}`,
        borderRadius: 8, color: theme.accent, cursor: "pointer",
        fontSize: 12, padding: "10px 16px", fontFamily: "inherit",
        fontWeight: 500, textAlign: "center" as const, width: "100%",
      }} onClick={() => setExpanded(true)}>
        Chat with Caul
      </button>
    );
  }

  return (
    <div style={{
      position: "sticky" as const, bottom: 0, marginTop: 12,
      background: theme.surface, border: `1px solid ${theme.border}`,
      borderRadius: 10, display: "flex", flexDirection: "column" as const,
      maxHeight: 280, minHeight: 160,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderBottom: `1px solid ${theme.border}` }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: theme.textMuted, textTransform: "uppercase" as const, letterSpacing: 1 }}>Chat</span>
        <button style={{ background: "none", border: "none", color: theme.textMuted, fontSize: 16, cursor: "pointer", fontFamily: "inherit", padding: "0 4px" }} onClick={() => setExpanded(false)}>&minus;</button>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "8px 12px", display: "flex", flexDirection: "column" as const, gap: 4 }}>
        {chatMessages.map((m, i) => (
          <div key={i} style={{
            padding: "4px 8px", borderRadius: 6, fontSize: 12, maxWidth: "85%", lineHeight: 1.4,
            ...(m.from === "user"
              ? { background: theme.border, color: theme.accent, alignSelf: "flex-end" as const }
              : { background: theme.bg, color: theme.text, alignSelf: "flex-start" as const }),
          }}>
            <span style={{ whiteSpace: "pre-wrap" as const, wordBreak: "break-word" as const }}>{m.text.replace(/^\[Spaces\]\s*/, "")}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div style={{ display: "flex", gap: 8, padding: "8px 12px", borderTop: `1px solid ${theme.border}` }}>
        <input
          style={{ flex: 1, background: theme.bg, border: `1px solid ${theme.inputBorder}`, borderRadius: 6, color: theme.text, padding: "8px 10px", fontSize: 12, fontFamily: "inherit", outline: "none" }}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder={placeholder}
        />
        <button style={{ background: theme.buttonBg, border: "none", borderRadius: 6, color: theme.buttonText, cursor: "pointer", fontSize: 14, padding: "6px 12px", fontFamily: "inherit", fontWeight: 600 }} onClick={handleSend}>&rarr;</button>
      </div>
    </div>
  );
}

// R404: Self-register as sidebar skill at module scope
registerSkill({
  id: "spaces",
  name: "Spaces",
  icon: "%",
  surface: "sidebar",
  component: SpacesView as React.ComponentType<ViewProps>,
  order: 70,
  core: false,
});
