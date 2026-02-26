// CRC: crc-ThemeProvider.md
import { useState, useEffect, useCallback, useRef } from "react";
import { useTheme, type ThemePalette } from "../theme";
import { registerSkill, type ViewProps } from "../skills-registry";

interface WsMessage {
  type: string;
  payload: unknown;
}

interface CrmViewProps {
  messages: WsMessage[];
  send: (type: string, payload: Record<string, unknown>) => void;
}

interface Contact {
  slug: string;
  name: string;
  aliases: string[];
  email?: string;
  phone?: string;
  social?: Record<string, string>;
  tags: string[];
  connections: Array<{ name: string; relationship: string }>;
  context: string;
  source: string;
  lastMentioned: string;
  created: string;
  notes: string;
}

const API = "/api/crm/contacts";

const TAG_COLORS: Record<string, string> = {
  "personal": "#4ade80",
  "professional": "#60a5fa",
  "research-target": "#c4b5fd",
  "potential-collaborator": "#f59e0b",
  "vendor": "#f87171",
  "friend": "#34d399",
};

const defaultTagColor = "#8888a0";

// R363: CrmView with theme colors
export function CrmView({ messages, send }: CrmViewProps) {
  const { theme, isDark } = useTheme();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(false);

  const [docPath, setDocPath] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formContext, setFormContext] = useState("");
  const [formTags, setFormTags] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formSource, setFormSource] = useState("manual");

  const fetchContacts = useCallback(async () => {
    try {
      const res = await fetch(API);
      setContacts(await res.json());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchContacts();
    const interval = setInterval(fetchContacts, 15_000);
    return () => clearInterval(interval);
  }, [fetchContacts]);

  const allTags = Array.from(new Set(contacts.flatMap((c) => c.tags))).sort();

  const filtered = contacts.filter((c) => {
    const q = search.toLowerCase();
    const matchSearch = !q || c.name.toLowerCase().includes(q) ||
      c.aliases.some((a) => a.toLowerCase().includes(q)) ||
      c.context.toLowerCase().includes(q) ||
      (c.email ?? "").toLowerCase().includes(q) ||
      c.tags.some((t) => t.toLowerCase().includes(q));
    const matchTag = !filterTag || c.tags.includes(filterTag);
    return matchSearch && matchTag;
  });

  const selectedContact = contacts.find((c) => c.slug === selected);

  const resetForm = () => {
    setFormName(""); setFormEmail(""); setFormPhone("");
    setFormContext(""); setFormTags(""); setFormNotes("");
    setFormSource("manual");
  };

  const createContact = async () => {
    if (!formName.trim()) return;
    await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formName,
        email: formEmail || undefined,
        phone: formPhone || undefined,
        context: formContext,
        tags: formTags.split(",").map((t) => t.trim()).filter(Boolean),
        notes: formNotes,
        source: formSource,
      }),
    });
    resetForm();
    setShowAdd(false);
    fetchContacts();
  };

  const updateContact = async () => {
    if (!selectedContact || !formName.trim()) return;
    await fetch(`${API}/${selectedContact.slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formName,
        email: formEmail || undefined,
        phone: formPhone || undefined,
        context: formContext,
        tags: formTags.split(",").map((t) => t.trim()).filter(Boolean),
        notes: formNotes,
        source: formSource,
      }),
    });
    setEditing(false);
    fetchContacts();
  };

  const deleteContact = async (slug: string) => {
    await fetch(`${API}/${slug}`, { method: "DELETE" });
    if (selected === slug) setSelected(null);
    fetchContacts();
  };

  const startEdit = (c: Contact) => {
    setFormName(c.name);
    setFormEmail(c.email ?? "");
    setFormPhone(c.phone ?? "");
    setFormContext(c.context);
    setFormTags(c.tags.join(", "));
    setFormNotes(c.notes);
    setFormSource(c.source);
    setEditing(true);
  };

  // Detail view
  if (selected && selectedContact) {
    if (editing) {
      return (
        <div style={{ padding: 20, height: "100%", overflow: "auto", display: "flex", flexDirection: "column" as const }}>
          <button onClick={() => { setEditing(false); }} style={{ background: "none", border: "none", color: theme.accent, fontSize: 13, cursor: "pointer", padding: "4px 0", marginBottom: 16, fontFamily: "inherit", textAlign: "left" as const }}>&larr; Cancel</button>
          <h2 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 600, color: theme.text }}>Edit Contact</h2>
          <ContactForm
            theme={theme} isDark={isDark}
            name={formName} setName={setFormName}
            email={formEmail} setEmail={setFormEmail}
            phone={formPhone} setPhone={setFormPhone}
            context={formContext} setContext={setFormContext}
            tags={formTags} setTags={setFormTags}
            notes={formNotes} setNotes={setFormNotes}
            source={formSource} setSource={setFormSource}
            onSubmit={updateContact}
            submitLabel="Save"
          />
        </div>
      );
    }

    return (
      <div style={{ padding: 20, height: "100%", overflow: "auto", display: "flex", flexDirection: "column" as const }}>
        <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: theme.accent, fontSize: 13, cursor: "pointer", padding: "4px 0", marginBottom: 16, fontFamily: "inherit", textAlign: "left" as const }}>&larr; All Contacts</button>
        <div style={{ background: theme.surface, borderRadius: 12, padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%",
              background: `linear-gradient(135deg, ${theme.accentSubtle}, ${theme.accent})`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 700, fontSize: 22, color: "#fff", flexShrink: 0,
            }}>{selectedContact.name[0]?.toUpperCase()}</div>
            <div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: theme.text }}>{selectedContact.name}</h2>
              {selectedContact.aliases.length > 0 && (
                <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>aka {selectedContact.aliases.join(", ")}</div>
              )}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column" as const, gap: 8, marginBottom: 16 }}>
            {selectedContact.email && (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${theme.border}`, fontSize: 13 }}>
                <span style={{ color: theme.textMuted, fontWeight: 500 }}>Email</span>
                <span style={{ color: theme.text }}>{selectedContact.email}</span>
              </div>
            )}
            {selectedContact.phone && (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${theme.border}`, fontSize: 13 }}>
                <span style={{ color: theme.textMuted, fontWeight: 500 }}>Phone</span>
                <span style={{ color: theme.text }}>{selectedContact.phone}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${theme.border}`, fontSize: 13 }}>
              <span style={{ color: theme.textMuted, fontWeight: 500 }}>Context</span>
              <span style={{ color: theme.text }}>{selectedContact.context || "\u2014"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${theme.border}`, fontSize: 13 }}>
              <span style={{ color: theme.textMuted, fontWeight: 500 }}>Source</span>
              <span style={{ color: theme.text }}>{selectedContact.source}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${theme.border}`, fontSize: 13 }}>
              <span style={{ color: theme.textMuted, fontWeight: 500 }}>Last mentioned</span>
              <span style={{ color: theme.text }}>{selectedContact.lastMentioned}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${theme.border}`, fontSize: 13 }}>
              <span style={{ color: theme.textMuted, fontWeight: 500 }}>Added</span>
              <span style={{ color: theme.text }}>{selectedContact.created}</span>
            </div>
          </div>

          {selectedContact.tags.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const, marginBottom: 16 }}>
              {selectedContact.tags.map((tag) => (
                <span key={tag} style={{ border: "1px solid", borderRadius: 12, fontSize: 11, padding: "3px 10px", fontWeight: 500, borderColor: TAG_COLORS[tag] ?? defaultTagColor, color: TAG_COLORS[tag] ?? defaultTagColor }}>
                  {tag}
                </span>
              ))}
            </div>
          )}

          {selectedContact.connections.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: theme.textMuted, marginBottom: 8, marginTop: 0, textTransform: "uppercase" as const, letterSpacing: 1 }}>Connections</h3>
              {selectedContact.connections.map((conn, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${theme.border}`, fontSize: 13 }}>
                  <span style={{ color: theme.accent, fontWeight: 500 }}>{conn.name}</span>
                  <span style={{ color: theme.textMuted }}>{conn.relationship}</span>
                </div>
              ))}
            </div>
          )}

          {selectedContact.notes && (
            <div style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: theme.textMuted, marginBottom: 8, marginTop: 0, textTransform: "uppercase" as const, letterSpacing: 1 }}>Notes</h3>
              <div style={{ fontSize: 13, color: theme.text, lineHeight: 1.6, whiteSpace: "pre-wrap" as const, background: theme.bg, borderRadius: 8, padding: 12 }}>
                <LinkedNotes text={selectedContact.notes} onDocClick={setDocPath} theme={theme} />
              </div>
            </div>
          )}

          {docPath && <DocViewer path={docPath} onClose={() => setDocPath(null)} theme={theme} />}

          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button style={{ background: theme.border, border: `1px solid ${theme.inputBorder}`, borderRadius: 6, color: theme.accent, cursor: "pointer", fontSize: 12, padding: "8px 20px", fontFamily: "inherit", fontWeight: 500 }} onClick={() => startEdit(selectedContact)}>Edit</button>
            <button style={{ background: "none", border: `1px solid ${theme.errorSubtle}`, borderRadius: 6, color: theme.error, cursor: "pointer", fontSize: 12, padding: "8px 20px", fontFamily: "inherit", marginLeft: "auto" }} onClick={() => deleteContact(selectedContact.slug)}>Delete</button>
          </div>
        </div>
        <CrmChat
          messages={messages}
          send={send}
          context={`[CRM: viewing ${selectedContact.name}] `}
          placeholder={`Chat about ${selectedContact.name}...`}
          theme={theme}
          isDark={isDark}
        />
      </div>
    );
  }

  // List view
  return (
    <div style={{ padding: 20, height: "100%", overflow: "auto", display: "flex", flexDirection: "column" as const }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: theme.text }}>Contacts</h2>
        <span style={{ fontSize: 12, color: theme.textMuted }}>{contacts.length} people</span>
        <button style={{ marginLeft: "auto", background: theme.buttonBg, border: "none", borderRadius: 6, color: theme.buttonText, cursor: "pointer", fontSize: 12, padding: "6px 16px", fontFamily: "inherit", fontWeight: 600 }} onClick={() => { resetForm(); setShowAdd(true); }}>+ Add</button>
      </div>

      <div style={{ display: "flex", flexDirection: "column" as const, gap: 8, marginBottom: 16 }}>
        <input
          style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 8, color: theme.text, padding: "10px 14px", fontSize: 13, fontFamily: "inherit", outline: "none" }}
          placeholder="Search contacts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {allTags.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const }}>
            <button
              style={{
                background: filterTag === null ? theme.border : "none",
                border: `1px solid ${filterTag === null ? theme.accentSubtle : theme.inputBorder}`,
                borderRadius: 12,
                color: filterTag === null ? theme.accent : theme.textMuted,
                cursor: "pointer", fontSize: 11, padding: "3px 10px", fontFamily: "inherit",
              }}
              onClick={() => setFilterTag(null)}
            >All</button>
            {allTags.map((tag) => (
              <button
                key={tag}
                style={{
                  background: filterTag === tag ? theme.border : "none",
                  border: `1px solid ${filterTag === tag ? (TAG_COLORS[tag] ?? defaultTagColor) : (TAG_COLORS[tag] ?? defaultTagColor)}`,
                  borderRadius: 12,
                  color: filterTag === tag ? theme.accent : theme.textMuted,
                  cursor: "pointer", fontSize: 11, padding: "3px 10px", fontFamily: "inherit",
                }}
                onClick={() => setFilterTag(filterTag === tag ? null : tag)}
              >{tag}</button>
            ))}
          </div>
        )}
      </div>

      {showAdd && (
        <div style={{ background: theme.surface, borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 600, color: theme.text }}>New Contact</h3>
          <ContactForm
            theme={theme} isDark={isDark}
            name={formName} setName={setFormName}
            email={formEmail} setEmail={setFormEmail}
            phone={formPhone} setPhone={setFormPhone}
            context={formContext} setContext={setFormContext}
            tags={formTags} setTags={setFormTags}
            notes={formNotes} setNotes={setFormNotes}
            source={formSource} setSource={setFormSource}
            onSubmit={createContact}
            submitLabel="Add Contact"
          />
          <button style={{ background: "none", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: 12, padding: "8px 0", fontFamily: "inherit", marginTop: 8 }} onClick={() => setShowAdd(false)}>Cancel</button>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column" as const, gap: 6, flex: 1, overflow: "auto" }}>
        {filtered.length === 0 && (
          <div style={{ color: theme.textMuted, fontSize: 13, padding: "40px 0", textAlign: "center" as const }}>
            {contacts.length === 0 ? "No contacts yet. Add one or mention someone in conversation." : "No matches."}
          </div>
        )}
        {filtered.map((c) => (
          <button key={c.slug} style={{
            display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
            background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 10,
            cursor: "pointer", textAlign: "left" as const, fontFamily: "inherit", color: theme.text,
          }} onClick={() => setSelected(c.slug)}>
            <div style={{
              width: 36, height: 36, borderRadius: "50%",
              background: `linear-gradient(135deg, ${theme.accentSubtle}, ${theme.accent})`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 700, fontSize: 14, color: "#fff", flexShrink: 0,
            }}>{c.name[0]?.toUpperCase()}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{c.name}</div>
              <div style={{ fontSize: 11, color: theme.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{c.context || c.email || "No context"}</div>
              <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                {c.tags.slice(0, 3).map((tag) => (
                  <span key={tag} style={{ fontSize: 10, fontWeight: 500, color: TAG_COLORS[tag] ?? defaultTagColor }}>{tag}</span>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "flex-end", gap: 2, flexShrink: 0 }}>
              <span style={{ fontSize: 10, color: theme.textFaint }}>{c.lastMentioned}</span>
              <span style={{ fontSize: 9, color: theme.textFaint, textTransform: "uppercase" as const, letterSpacing: 0.5 }}>{c.source}</span>
            </div>
          </button>
        ))}
      </div>
      <CrmChat
        messages={messages}
        send={send}
        context="[CRM: contacts list] "
        placeholder="Chat about your contacts..."
        theme={theme}
        isDark={isDark}
      />
    </div>
  );
}

// Detect file paths and make them clickable
function LinkedNotes({ text, onDocClick, theme }: { text: string; onDocClick: (path: string) => void; theme: ThemePalette }) {
  const pathPattern = /((?:HalShare|~\/\.homaruscc)\/[\w./_-]+\.md)/g;
  const parts: Array<{ type: "text" | "link"; value: string }> = [];
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  while ((match = pathPattern.exec(text)) !== null) {
    if (match.index > lastIdx) parts.push({ type: "text", value: text.slice(lastIdx, match.index) });
    parts.push({ type: "link", value: match[1] });
    lastIdx = match.index + match[0].length;
  }
  if (lastIdx < text.length) parts.push({ type: "text", value: text.slice(lastIdx) });

  return (
    <>
      {parts.map((p, i) =>
        p.type === "link" ? (
          <button
            key={i}
            onClick={() => onDocClick(p.value)}
            style={{
              background: "none",
              border: `1px solid ${theme.accentSubtle}`,
              borderRadius: 4,
              color: theme.accent,
              cursor: "pointer",
              fontSize: 12,
              padding: "1px 6px",
              fontFamily: "inherit",
              fontWeight: 500,
              display: "inline",
            }}
          >
            {p.value.split("/").pop()}
          </button>
        ) : (
          <span key={i}>{p.value}</span>
        )
      )}
    </>
  );
}

// Lightweight markdown to HTML
function renderMarkdown(md: string, theme: ThemePalette): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const lines = md.split("\n");
  const out: string[] = [];
  let inCode = false;
  let inTable = false;
  let inList: string | null = null;

  const inlineFmt = (line: string): string => {
    let s = esc(line);
    s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/\*(.+?)\*/g, "<em>$1</em>");
    s = s.replace(/`(.+?)`/g, `<code style="background:${theme.border};padding:1px 4px;border-radius:3px">$1</code>`);
    s = s.replace(/\[(.+?)\]\((.+?)\)/g, `<a href="$2" style="color:${theme.accent}" target="_blank">$1</a>`);
    return s;
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];

    if (raw.startsWith("```")) {
      if (inCode) { out.push("</pre>"); inCode = false; }
      else { out.push(`<pre style="background:${theme.bg};padding:12px;border-radius:6px;overflow-x:auto;font-size:12px">`); inCode = true; }
      continue;
    }
    if (inCode) { out.push(esc(raw)); out.push("\n"); continue; }

    const trimmed = raw.trim();

    if (inList && !trimmed.startsWith("- ") && !trimmed.startsWith("* ") && !/^\d+\.\s/.test(trimmed) && trimmed !== "") {
      out.push(`</${inList}>`); inList = null;
    }

    if (/^-{3,}$/.test(trimmed) || /^\*{3,}$/.test(trimmed)) {
      out.push(`<hr style="border:none;border-top:1px solid ${theme.border};margin:12px 0">`);
      continue;
    }

    const hMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (hMatch) {
      const level = hMatch[1].length;
      const sizes = [20, 17, 15, 14, 13, 12];
      out.push(`<h${level} style="color:${theme.text};font-size:${sizes[level - 1]}px;margin:16px 0 8px;font-weight:600">${inlineFmt(hMatch[2])}</h${level}>`);
      continue;
    }

    if (trimmed.startsWith("|")) {
      if (!inTable) { out.push(`<table style="width:100%;border-collapse:collapse;margin:8px 0;font-size:12px">`); inTable = true; }
      if (/^\|[\s-:|]+\|$/.test(trimmed)) continue;
      const cells = trimmed.split("|").slice(1, -1).map((c) => c.trim());
      out.push("<tr>");
      cells.forEach((c) => out.push(`<td style="padding:6px 10px;border-bottom:1px solid ${theme.border};color:${theme.text}">${inlineFmt(c)}</td>`));
      out.push("</tr>");
      continue;
    }
    if (inTable && !trimmed.startsWith("|")) { out.push("</table>"); inTable = false; }

    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      if (inList !== "ul") { if (inList) out.push(`</${inList}>`); out.push('<ul style="margin:4px 0;padding-left:20px">'); inList = "ul"; }
      const content = trimmed.replace(/^[-*]\s+/, "");
      if (content.startsWith("[ ] ")) out.push(`<li style="margin:2px 0;color:${theme.text};list-style:none;margin-left:-16px">&#9744; ${inlineFmt(content.slice(4))}</li>`);
      else if (content.startsWith("[x] ")) out.push(`<li style="margin:2px 0;color:${theme.textMuted};list-style:none;margin-left:-16px;text-decoration:line-through">&#9745; ${inlineFmt(content.slice(4))}</li>`);
      else out.push(`<li style="margin:2px 0;color:${theme.text}">${inlineFmt(content)}</li>`);
      continue;
    }

    const olMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
    if (olMatch) {
      if (inList !== "ol") { if (inList) out.push(`</${inList}>`); out.push('<ol style="margin:4px 0;padding-left:20px">'); inList = "ol"; }
      out.push(`<li style="margin:2px 0;color:${theme.text}">${inlineFmt(olMatch[2])}</li>`);
      continue;
    }

    if (trimmed === "") { out.push("<br>"); continue; }

    out.push(`<p style="margin:4px 0;color:${theme.text};line-height:1.6">${inlineFmt(trimmed)}</p>`);
  }

  if (inCode) out.push("</pre>");
  if (inTable) out.push("</table>");
  if (inList) out.push(`</${inList}>`);

  return out.join("\n");
}

function DocViewer({ path, onClose, theme }: { path: string; onClose: () => void; theme: ThemePalette }) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/docs?path=${encodeURIComponent(path)}`)
      .then((r) => {
        if (!r.ok) throw new Error("Document not found");
        return r.text();
      })
      .then((text) => { setContent(text); setLoading(false); })
      .catch((e) => { setError(String(e)); setLoading(false); });
  }, [path]);

  return (
    <div style={{ position: "fixed" as const, inset: 0, background: theme.overlay, zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={onClose}>
      <div style={{ background: theme.surface, borderRadius: 12, border: `1px solid ${theme.border}`, width: "100%", maxWidth: 800, maxHeight: "85vh", display: "flex", flexDirection: "column" as const }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderBottom: `1px solid ${theme.border}` }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>{path.split("/").pop()}</span>
          <span style={{ fontSize: 11, color: theme.textFaint, flex: 1 }}>{path}</span>
          <button style={{ background: "none", border: "none", color: theme.textMuted, fontSize: 20, cursor: "pointer", fontFamily: "inherit", padding: "0 4px" }} onClick={onClose}>&times;</button>
        </div>
        <div style={{ flex: 1, overflow: "auto", padding: 18 }}>
          {loading && <div style={{ color: theme.textMuted, fontSize: 13 }}>Loading...</div>}
          {error && <div style={{ color: theme.error, fontSize: 13 }}>{error}</div>}
          {content && (
            <div
              style={{ color: theme.text, fontSize: 13, lineHeight: 1.6, fontFamily: "inherit" }}
              dangerouslySetInnerHTML={{ __html: renderMarkdown(content, theme) }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function CrmChat({ messages, send, context, placeholder, theme }: {
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
    .map((m) => m.payload as { from: string; text: string; timestamp: number })
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
            <span style={{ whiteSpace: "pre-wrap" as const, wordBreak: "break-word" as const }}>{m.text.replace(/^\[CRM:.*?\]\s*/, "")}</span>
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

function ContactForm(props: {
  theme: ThemePalette;
  isDark: boolean;
  name: string; setName: (v: string) => void;
  email: string; setEmail: (v: string) => void;
  phone: string; setPhone: (v: string) => void;
  context: string; setContext: (v: string) => void;
  tags: string; setTags: (v: string) => void;
  notes: string; setNotes: (v: string) => void;
  source: string; setSource: (v: string) => void;
  onSubmit: () => void;
  submitLabel: string;
}) {
  const { theme } = props;
  const inputStyle: React.CSSProperties = {
    background: theme.bg,
    border: `1px solid ${theme.inputBorder}`,
    borderRadius: 6,
    color: theme.text,
    padding: "8px 10px",
    fontSize: 13,
    fontFamily: "inherit",
    outline: "none",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column" as const, gap: 12 }}>
      <div style={{ display: "flex", flexDirection: "column" as const, gap: 4 }}>
        <label style={{ fontSize: 11, color: theme.textMuted, fontWeight: 500, textTransform: "uppercase" as const, letterSpacing: 0.5 }}>Name *</label>
        <input style={inputStyle} value={props.name} onChange={(e) => props.setName(e.target.value)} autoFocus />
      </div>
      <div style={{ display: "flex", flexDirection: "column" as const, gap: 4 }}>
        <label style={{ fontSize: 11, color: theme.textMuted, fontWeight: 500, textTransform: "uppercase" as const, letterSpacing: 0.5 }}>Email</label>
        <input style={inputStyle} value={props.email} onChange={(e) => props.setEmail(e.target.value)} />
      </div>
      <div style={{ display: "flex", flexDirection: "column" as const, gap: 4 }}>
        <label style={{ fontSize: 11, color: theme.textMuted, fontWeight: 500, textTransform: "uppercase" as const, letterSpacing: 0.5 }}>Phone</label>
        <input style={inputStyle} value={props.phone} onChange={(e) => props.setPhone(e.target.value)} />
      </div>
      <div style={{ display: "flex", flexDirection: "column" as const, gap: 4 }}>
        <label style={{ fontSize: 11, color: theme.textMuted, fontWeight: 500, textTransform: "uppercase" as const, letterSpacing: 0.5 }}>Context</label>
        <input style={inputStyle} value={props.context} onChange={(e) => props.setContext(e.target.value)} placeholder="How you know them / who they are" />
      </div>
      <div style={{ display: "flex", flexDirection: "column" as const, gap: 4 }}>
        <label style={{ fontSize: 11, color: theme.textMuted, fontWeight: 500, textTransform: "uppercase" as const, letterSpacing: 0.5 }}>Tags</label>
        <input style={inputStyle} value={props.tags} onChange={(e) => props.setTags(e.target.value)} placeholder="comma-separated: friend, professional" />
      </div>
      <div style={{ display: "flex", flexDirection: "column" as const, gap: 4 }}>
        <label style={{ fontSize: 11, color: theme.textMuted, fontWeight: 500, textTransform: "uppercase" as const, letterSpacing: 0.5 }}>Source</label>
        <div style={{ display: "flex", gap: 8 }}>
          {["manual", "conversation", "research"].map((s) => (
            <button
              key={s}
              style={{
                background: props.source === s ? theme.buttonBg : "none",
                borderColor: props.source === s ? theme.buttonBg : theme.inputBorder,
                border: `1px solid ${props.source === s ? theme.buttonBg : theme.inputBorder}`,
                borderRadius: 6,
                color: props.source === s ? theme.buttonText : theme.textMuted,
                cursor: "pointer", fontSize: 11, padding: "4px 12px",
                fontFamily: "inherit", fontWeight: 500,
              }}
              onClick={() => props.setSource(s)}
            >{s}</button>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column" as const, gap: 4 }}>
        <label style={{ fontSize: 11, color: theme.textMuted, fontWeight: 500, textTransform: "uppercase" as const, letterSpacing: 0.5 }}>Notes</label>
        <textarea style={{ ...inputStyle, resize: "vertical" as const }} value={props.notes} onChange={(e) => props.setNotes(e.target.value)} rows={4} placeholder="Freeform notes..." />
      </div>
      <button style={{ background: theme.buttonBg, border: "none", borderRadius: 6, color: theme.buttonText, cursor: "pointer", fontSize: 13, padding: "10px 20px", fontFamily: "inherit", fontWeight: 600, marginTop: 4 }} onClick={props.onSubmit}>{props.submitLabel}</button>
    </div>
  );
}

// R404: Self-register as sidebar skill at module scope
registerSkill({
  id: "crm",
  name: "People",
  icon: "&",
  surface: "sidebar",
  component: CrmView as React.ComponentType<ViewProps>,
  order: 60,
  core: false,
});
