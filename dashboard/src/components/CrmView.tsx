import { useState, useEffect, useCallback, useRef } from "react";

interface WsMessage {
  type: string;
  payload: Record<string, unknown>;
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

export function CrmView({ messages, send }: CrmViewProps) {
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
        <div style={styles.container}>
          <button onClick={() => { setEditing(false); }} style={styles.backBtn}>&larr; Cancel</button>
          <h2 style={styles.heading}>Edit Contact</h2>
          <ContactForm
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
      <div style={styles.container}>
        <button onClick={() => setSelected(null)} style={styles.backBtn}>&larr; All Contacts</button>
        <div style={styles.detailCard}>
          <div style={styles.detailHeader}>
            <div style={styles.avatar}>{selectedContact.name[0]?.toUpperCase()}</div>
            <div>
              <h2 style={styles.detailName}>{selectedContact.name}</h2>
              {selectedContact.aliases.length > 0 && (
                <div style={styles.detailAliases}>aka {selectedContact.aliases.join(", ")}</div>
              )}
            </div>
          </div>

          <div style={styles.detailMeta}>
            {selectedContact.email && (
              <div style={styles.metaRow}>
                <span style={styles.metaLabel}>Email</span>
                <span style={styles.metaValue}>{selectedContact.email}</span>
              </div>
            )}
            {selectedContact.phone && (
              <div style={styles.metaRow}>
                <span style={styles.metaLabel}>Phone</span>
                <span style={styles.metaValue}>{selectedContact.phone}</span>
              </div>
            )}
            <div style={styles.metaRow}>
              <span style={styles.metaLabel}>Context</span>
              <span style={styles.metaValue}>{selectedContact.context || "—"}</span>
            </div>
            <div style={styles.metaRow}>
              <span style={styles.metaLabel}>Source</span>
              <span style={styles.metaValue}>{selectedContact.source}</span>
            </div>
            <div style={styles.metaRow}>
              <span style={styles.metaLabel}>Last mentioned</span>
              <span style={styles.metaValue}>{selectedContact.lastMentioned}</span>
            </div>
            <div style={styles.metaRow}>
              <span style={styles.metaLabel}>Added</span>
              <span style={styles.metaValue}>{selectedContact.created}</span>
            </div>
          </div>

          {selectedContact.tags.length > 0 && (
            <div style={styles.tagRow}>
              {selectedContact.tags.map((tag) => (
                <span key={tag} style={{ ...styles.tag, borderColor: TAG_COLORS[tag] ?? defaultTagColor, color: TAG_COLORS[tag] ?? defaultTagColor }}>
                  {tag}
                </span>
              ))}
            </div>
          )}

          {selectedContact.connections.length > 0 && (
            <div style={styles.connectionsSection}>
              <h3 style={styles.sectionTitle}>Connections</h3>
              {selectedContact.connections.map((conn, i) => (
                <div key={i} style={styles.connectionRow}>
                  <span style={styles.connectionName}>{conn.name}</span>
                  <span style={styles.connectionRel}>{conn.relationship}</span>
                </div>
              ))}
            </div>
          )}

          {selectedContact.notes && (
            <div style={styles.notesSection}>
              <h3 style={styles.sectionTitle}>Notes</h3>
              <div style={styles.notesContent}>
                <LinkedNotes text={selectedContact.notes} onDocClick={setDocPath} />
              </div>
            </div>
          )}

          {docPath && <DocViewer path={docPath} onClose={() => setDocPath(null)} />}

          <div style={styles.detailActions}>
            <button style={styles.btnEdit} onClick={() => startEdit(selectedContact)}>Edit</button>
            <button style={styles.btnDelete} onClick={() => deleteContact(selectedContact.slug)}>Delete</button>
          </div>
        </div>
        <CrmChat
          messages={messages}
          send={send}
          context={`[CRM: viewing ${selectedContact.name}] `}
          placeholder={`Chat about ${selectedContact.name}...`}
        />
      </div>
    );
  }

  // List view
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.heading}>Contacts</h2>
        <span style={styles.count}>{contacts.length} people</span>
        <button style={styles.addBtn} onClick={() => { resetForm(); setShowAdd(true); }}>+ Add</button>
      </div>

      <div style={styles.filterRow}>
        <input
          style={styles.searchInput}
          placeholder="Search contacts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {allTags.length > 0 && (
          <div style={styles.tagFilter}>
            <button
              style={{ ...styles.filterChip, ...(filterTag === null ? styles.filterChipActive : {}) }}
              onClick={() => setFilterTag(null)}
            >All</button>
            {allTags.map((tag) => (
              <button
                key={tag}
                style={{ ...styles.filterChip, ...(filterTag === tag ? styles.filterChipActive : {}), borderColor: TAG_COLORS[tag] ?? defaultTagColor }}
                onClick={() => setFilterTag(filterTag === tag ? null : tag)}
              >{tag}</button>
            ))}
          </div>
        )}
      </div>

      {showAdd && (
        <div style={styles.addFormContainer}>
          <h3 style={styles.addFormTitle}>New Contact</h3>
          <ContactForm
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
          <button style={styles.cancelFormBtn} onClick={() => setShowAdd(false)}>Cancel</button>
        </div>
      )}

      <div style={styles.contactList}>
        {filtered.length === 0 && (
          <div style={styles.empty}>
            {contacts.length === 0 ? "No contacts yet. Add one or mention someone in conversation." : "No matches."}
          </div>
        )}
        {filtered.map((c) => (
          <button key={c.slug} style={styles.contactCard} onClick={() => setSelected(c.slug)}>
            <div style={styles.cardAvatar}>{c.name[0]?.toUpperCase()}</div>
            <div style={styles.cardInfo}>
              <div style={styles.cardName}>{c.name}</div>
              <div style={styles.cardContext}>{c.context || c.email || "No context"}</div>
              <div style={styles.cardTags}>
                {c.tags.slice(0, 3).map((tag) => (
                  <span key={tag} style={{ ...styles.cardTag, color: TAG_COLORS[tag] ?? defaultTagColor }}>{tag}</span>
                ))}
              </div>
            </div>
            <div style={styles.cardMeta}>
              <span style={styles.cardDate}>{c.lastMentioned}</span>
              <span style={styles.cardSource}>{c.source}</span>
            </div>
          </button>
        ))}
      </div>
      <CrmChat
        messages={messages}
        send={send}
        context="[CRM: contacts list] "
        placeholder="Chat about your contacts..."
      />
    </div>
  );
}

// Detect file paths like "HalShare/..." or "~/.homaruscc/..." and make them clickable
function LinkedNotes({ text, onDocClick }: { text: string; onDocClick: (path: string) => void }) {
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
            style={docStyles.fileLink}
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

// Lightweight markdown to HTML — handles headers, bold, italic, links, lists, tables, code blocks, hr
function renderMarkdown(md: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const lines = md.split("\n");
  const out: string[] = [];
  let inCode = false;
  let inTable = false;
  let inList: string | null = null; // "ul" or "ol"

  const inlineFmt = (line: string): string => {
    let s = esc(line);
    s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/\*(.+?)\*/g, "<em>$1</em>");
    s = s.replace(/`(.+?)`/g, '<code style="background:#1e1e2e;padding:1px 4px;border-radius:3px">$1</code>');
    s = s.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" style="color:#c4b5fd" target="_blank">$1</a>');
    return s;
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];

    // Code blocks
    if (raw.startsWith("```")) {
      if (inCode) { out.push("</pre>"); inCode = false; }
      else { out.push('<pre style="background:#0a0a0f;padding:12px;border-radius:6px;overflow-x:auto;font-size:12px">'); inCode = true; }
      continue;
    }
    if (inCode) { out.push(esc(raw)); out.push("\n"); continue; }

    const trimmed = raw.trim();

    // Close list if no longer in list context
    if (inList && !trimmed.startsWith("- ") && !trimmed.startsWith("* ") && !/^\d+\.\s/.test(trimmed) && trimmed !== "") {
      out.push(`</${inList}>`); inList = null;
    }

    // HR
    if (/^-{3,}$/.test(trimmed) || /^\*{3,}$/.test(trimmed)) {
      out.push('<hr style="border:none;border-top:1px solid #1e1e2e;margin:12px 0">');
      continue;
    }

    // Headers
    const hMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (hMatch) {
      const level = hMatch[1].length;
      const sizes = [20, 17, 15, 14, 13, 12];
      out.push(`<h${level} style="color:#e0e0e8;font-size:${sizes[level - 1]}px;margin:16px 0 8px;font-weight:600">${inlineFmt(hMatch[2])}</h${level}>`);
      continue;
    }

    // Table
    if (trimmed.startsWith("|")) {
      if (!inTable) { out.push('<table style="width:100%;border-collapse:collapse;margin:8px 0;font-size:12px">'); inTable = true; }
      if (/^\|[\s-:|]+\|$/.test(trimmed)) continue; // separator row
      const cells = trimmed.split("|").slice(1, -1).map((c) => c.trim());
      out.push("<tr>");
      cells.forEach((c) => out.push(`<td style="padding:6px 10px;border-bottom:1px solid #1e1e2e;color:#e0e0e8">${inlineFmt(c)}</td>`));
      out.push("</tr>");
      continue;
    }
    if (inTable && !trimmed.startsWith("|")) { out.push("</table>"); inTable = false; }

    // Unordered list
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      if (inList !== "ul") { if (inList) out.push(`</${inList}>`); out.push('<ul style="margin:4px 0;padding-left:20px">'); inList = "ul"; }
      const content = trimmed.replace(/^[-*]\s+/, "");
      // Check for checkbox
      if (content.startsWith("[ ] ")) out.push(`<li style="margin:2px 0;color:#e0e0e8;list-style:none;margin-left:-16px">&#9744; ${inlineFmt(content.slice(4))}</li>`);
      else if (content.startsWith("[x] ")) out.push(`<li style="margin:2px 0;color:#8888a0;list-style:none;margin-left:-16px;text-decoration:line-through">&#9745; ${inlineFmt(content.slice(4))}</li>`);
      else out.push(`<li style="margin:2px 0;color:#e0e0e8">${inlineFmt(content)}</li>`);
      continue;
    }

    // Ordered list
    const olMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
    if (olMatch) {
      if (inList !== "ol") { if (inList) out.push(`</${inList}>`); out.push('<ol style="margin:4px 0;padding-left:20px">'); inList = "ol"; }
      out.push(`<li style="margin:2px 0;color:#e0e0e8">${inlineFmt(olMatch[2])}</li>`);
      continue;
    }

    // Empty line
    if (trimmed === "") { out.push("<br>"); continue; }

    // Regular paragraph
    out.push(`<p style="margin:4px 0;color:#e0e0e8;line-height:1.6">${inlineFmt(trimmed)}</p>`);
  }

  if (inCode) out.push("</pre>");
  if (inTable) out.push("</table>");
  if (inList) out.push(`</${inList}>`);

  return out.join("\n");
}

function DocViewer({ path, onClose }: { path: string; onClose: () => void }) {
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
    <div style={docStyles.overlay} onClick={onClose}>
      <div style={docStyles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={docStyles.modalHeader}>
          <span style={docStyles.modalTitle}>{path.split("/").pop()}</span>
          <span style={docStyles.modalPath}>{path}</span>
          <button style={docStyles.closeBtn} onClick={onClose}>&times;</button>
        </div>
        <div style={docStyles.modalBody}>
          {loading && <div style={docStyles.loading}>Loading...</div>}
          {error && <div style={docStyles.error}>{error}</div>}
          {content && (
            <div
              style={docStyles.docContent}
              dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

const docStyles: Record<string, React.CSSProperties> = {
  fileLink: {
    background: "none",
    border: "1px solid #7c3aed",
    borderRadius: 4,
    color: "#c4b5fd",
    cursor: "pointer",
    fontSize: 12,
    padding: "1px 6px",
    fontFamily: "inherit",
    fontWeight: 500,
    display: "inline",
  },
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.7)",
    zIndex: 300,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modal: {
    background: "#12121a",
    borderRadius: 12,
    border: "1px solid #1e1e2e",
    width: "100%",
    maxWidth: 800,
    maxHeight: "85vh",
    display: "flex",
    flexDirection: "column",
  },
  modalHeader: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "14px 18px",
    borderBottom: "1px solid #1e1e2e",
  },
  modalTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: "#e0e0e8",
  },
  modalPath: {
    fontSize: 11,
    color: "#555",
    flex: 1,
  },
  closeBtn: {
    background: "none",
    border: "none",
    color: "#8888a0",
    fontSize: 20,
    cursor: "pointer",
    fontFamily: "inherit",
    padding: "0 4px",
  },
  modalBody: {
    flex: 1,
    overflow: "auto",
    padding: 18,
  },
  loading: {
    color: "#8888a0",
    fontSize: 13,
  },
  error: {
    color: "#f87171",
    fontSize: 13,
  },
  docContent: {
    color: "#e0e0e8",
    fontSize: 13,
    lineHeight: 1.6,
    fontFamily: "inherit",
  },
};

function CrmChat({ messages, send, context, placeholder }: {
  messages: WsMessage[];
  send: (type: string, payload: Record<string, unknown>) => void;
  context: string;
  placeholder: string;
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
      <button style={chatStyles.toggle} onClick={() => setExpanded(true)}>
        Chat with Caul
      </button>
    );
  }

  return (
    <div style={chatStyles.container}>
      <div style={chatStyles.header}>
        <span style={chatStyles.headerText}>Chat</span>
        <button style={chatStyles.collapseBtn} onClick={() => setExpanded(false)}>&minus;</button>
      </div>
      <div style={chatStyles.messageList}>
        {chatMessages.map((m, i) => (
          <div key={i} style={{ ...chatStyles.msg, ...(m.from === "user" ? chatStyles.msgUser : chatStyles.msgAssistant) }}>
            <span style={chatStyles.msgText}>{m.text.replace(/^\[CRM:.*?\]\s*/, "")}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div style={chatStyles.inputRow}>
        <input
          style={chatStyles.input}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder={placeholder}
        />
        <button style={chatStyles.sendBtn} onClick={handleSend}>&rarr;</button>
      </div>
    </div>
  );
}

const chatStyles: Record<string, React.CSSProperties> = {
  toggle: {
    position: "sticky",
    bottom: 0,
    marginTop: 12,
    background: "#1e1e2e",
    border: "1px solid #333",
    borderRadius: 8,
    color: "#c4b5fd",
    cursor: "pointer",
    fontSize: 12,
    padding: "10px 16px",
    fontFamily: "inherit",
    fontWeight: 500,
    textAlign: "center",
    width: "100%",
  },
  container: {
    position: "sticky",
    bottom: 0,
    marginTop: 12,
    background: "#12121a",
    border: "1px solid #1e1e2e",
    borderRadius: 10,
    display: "flex",
    flexDirection: "column",
    maxHeight: 280,
    minHeight: 160,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 12px",
    borderBottom: "1px solid #1e1e2e",
  },
  headerText: {
    fontSize: 12,
    fontWeight: 600,
    color: "#8888a0",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  collapseBtn: {
    background: "none",
    border: "none",
    color: "#8888a0",
    fontSize: 16,
    cursor: "pointer",
    fontFamily: "inherit",
    padding: "0 4px",
  },
  messageList: {
    flex: 1,
    overflow: "auto",
    padding: "8px 12px",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  msg: {
    padding: "4px 8px",
    borderRadius: 6,
    fontSize: 12,
    maxWidth: "85%",
    lineHeight: 1.4,
  },
  msgUser: {
    background: "#1e1e2e",
    color: "#c4b5fd",
    alignSelf: "flex-end",
  },
  msgAssistant: {
    background: "#0a0a0f",
    color: "#e0e0e8",
    alignSelf: "flex-start",
  },
  msgText: {
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  inputRow: {
    display: "flex",
    gap: 8,
    padding: "8px 12px",
    borderTop: "1px solid #1e1e2e",
  },
  input: {
    flex: 1,
    background: "#0a0a0f",
    border: "1px solid #333",
    borderRadius: 6,
    color: "#e0e0e8",
    padding: "8px 10px",
    fontSize: 12,
    fontFamily: "inherit",
    outline: "none",
  },
  sendBtn: {
    background: "#7c3aed",
    border: "none",
    borderRadius: 6,
    color: "#fff",
    cursor: "pointer",
    fontSize: 14,
    padding: "6px 12px",
    fontFamily: "inherit",
    fontWeight: 600,
  },
};

function ContactForm(props: {
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
  return (
    <div style={styles.formGrid}>
      <div style={styles.formRow}>
        <label style={styles.formLabel}>Name *</label>
        <input style={styles.formInput} value={props.name} onChange={(e) => props.setName(e.target.value)} autoFocus />
      </div>
      <div style={styles.formRow}>
        <label style={styles.formLabel}>Email</label>
        <input style={styles.formInput} value={props.email} onChange={(e) => props.setEmail(e.target.value)} />
      </div>
      <div style={styles.formRow}>
        <label style={styles.formLabel}>Phone</label>
        <input style={styles.formInput} value={props.phone} onChange={(e) => props.setPhone(e.target.value)} />
      </div>
      <div style={styles.formRow}>
        <label style={styles.formLabel}>Context</label>
        <input style={styles.formInput} value={props.context} onChange={(e) => props.setContext(e.target.value)} placeholder="How you know them / who they are" />
      </div>
      <div style={styles.formRow}>
        <label style={styles.formLabel}>Tags</label>
        <input style={styles.formInput} value={props.tags} onChange={(e) => props.setTags(e.target.value)} placeholder="comma-separated: friend, professional" />
      </div>
      <div style={styles.formRow}>
        <label style={styles.formLabel}>Source</label>
        <div style={styles.sourceRow}>
          {["manual", "conversation", "research"].map((s) => (
            <button
              key={s}
              style={{ ...styles.sourceBtn, ...(props.source === s ? styles.sourceBtnActive : {}) }}
              onClick={() => props.setSource(s)}
            >{s}</button>
          ))}
        </div>
      </div>
      <div style={styles.formRow}>
        <label style={styles.formLabel}>Notes</label>
        <textarea style={styles.formTextarea} value={props.notes} onChange={(e) => props.setNotes(e.target.value)} rows={4} placeholder="Freeform notes..." />
      </div>
      <button style={styles.submitBtn} onClick={props.onSubmit}>{props.submitLabel}</button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: 20,
    height: "100%",
    overflow: "auto",
    display: "flex",
    flexDirection: "column",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  heading: {
    margin: 0,
    fontSize: 18,
    fontWeight: 600,
    color: "#e0e0e8",
  },
  count: {
    fontSize: 12,
    color: "#8888a0",
  },
  addBtn: {
    marginLeft: "auto",
    background: "#7c3aed",
    border: "none",
    borderRadius: 6,
    color: "#fff",
    cursor: "pointer",
    fontSize: 12,
    padding: "6px 16px",
    fontFamily: "inherit",
    fontWeight: 600,
  },
  filterRow: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    marginBottom: 16,
  },
  searchInput: {
    background: "#12121a",
    border: "1px solid #1e1e2e",
    borderRadius: 8,
    color: "#e0e0e8",
    padding: "10px 14px",
    fontSize: 13,
    fontFamily: "inherit",
    outline: "none",
  },
  tagFilter: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
  },
  filterChip: {
    background: "none",
    border: "1px solid #333",
    borderRadius: 12,
    color: "#8888a0",
    cursor: "pointer",
    fontSize: 11,
    padding: "3px 10px",
    fontFamily: "inherit",
  },
  filterChipActive: {
    background: "#1e1e2e",
    color: "#c4b5fd",
    borderColor: "#7c3aed",
  },
  contactList: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    flex: 1,
    overflow: "auto",
  },
  contactCard: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 14px",
    background: "#12121a",
    border: "1px solid #1e1e2e",
    borderRadius: 10,
    cursor: "pointer",
    textAlign: "left",
    fontFamily: "inherit",
    color: "#e0e0e8",
  },
  cardAvatar: {
    width: 36,
    height: 36,
    borderRadius: "50%",
    background: "linear-gradient(135deg, #7c3aed, #c4b5fd)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: 14,
    color: "#fff",
    flexShrink: 0,
  },
  cardInfo: {
    flex: 1,
    minWidth: 0,
  },
  cardName: {
    fontSize: 14,
    fontWeight: 600,
    marginBottom: 2,
  },
  cardContext: {
    fontSize: 11,
    color: "#8888a0",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  cardTags: {
    display: "flex",
    gap: 6,
    marginTop: 4,
  },
  cardTag: {
    fontSize: 10,
    fontWeight: 500,
  },
  cardMeta: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 2,
    flexShrink: 0,
  },
  cardDate: {
    fontSize: 10,
    color: "#555",
  },
  cardSource: {
    fontSize: 9,
    color: "#555",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  empty: {
    color: "#8888a0",
    fontSize: 13,
    padding: "40px 0",
    textAlign: "center",
  },
  backBtn: {
    background: "none",
    border: "none",
    color: "#c4b5fd",
    fontSize: 13,
    cursor: "pointer",
    padding: "4px 0",
    marginBottom: 16,
    fontFamily: "inherit",
    textAlign: "left",
  },
  detailCard: {
    background: "#12121a",
    borderRadius: 12,
    padding: 20,
  },
  detailHeader: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    marginBottom: 20,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: "50%",
    background: "linear-gradient(135deg, #7c3aed, #c4b5fd)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: 22,
    color: "#fff",
    flexShrink: 0,
  },
  detailName: {
    margin: 0,
    fontSize: 20,
    fontWeight: 600,
    color: "#e0e0e8",
  },
  detailAliases: {
    fontSize: 12,
    color: "#8888a0",
    marginTop: 2,
  },
  detailMeta: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    marginBottom: 16,
  },
  metaRow: {
    display: "flex",
    justifyContent: "space-between",
    padding: "6px 0",
    borderBottom: "1px solid #1e1e2e",
    fontSize: 13,
  },
  metaLabel: {
    color: "#8888a0",
    fontWeight: 500,
  },
  metaValue: {
    color: "#e0e0e8",
  },
  tagRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 16,
  },
  tag: {
    border: "1px solid",
    borderRadius: 12,
    fontSize: 11,
    padding: "3px 10px",
    fontWeight: 500,
  },
  connectionsSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: "#8888a0",
    marginBottom: 8,
    marginTop: 0,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  connectionRow: {
    display: "flex",
    justifyContent: "space-between",
    padding: "6px 0",
    borderBottom: "1px solid #1e1e2e",
    fontSize: 13,
  },
  connectionName: {
    color: "#c4b5fd",
    fontWeight: 500,
  },
  connectionRel: {
    color: "#8888a0",
  },
  notesSection: {
    marginBottom: 16,
  },
  notesContent: {
    fontSize: 13,
    color: "#e0e0e8",
    lineHeight: 1.6,
    whiteSpace: "pre-wrap",
    background: "#0a0a0f",
    borderRadius: 8,
    padding: 12,
  },
  detailActions: {
    display: "flex",
    gap: 8,
    marginTop: 16,
  },
  btnEdit: {
    background: "#1e1e2e",
    border: "1px solid #333",
    borderRadius: 6,
    color: "#c4b5fd",
    cursor: "pointer",
    fontSize: 12,
    padding: "8px 20px",
    fontFamily: "inherit",
    fontWeight: 500,
  },
  btnDelete: {
    background: "none",
    border: "1px solid #4a1a1a",
    borderRadius: 6,
    color: "#f87171",
    cursor: "pointer",
    fontSize: 12,
    padding: "8px 20px",
    fontFamily: "inherit",
    marginLeft: "auto",
  },
  addFormContainer: {
    background: "#12121a",
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  addFormTitle: {
    margin: "0 0 16px",
    fontSize: 15,
    fontWeight: 600,
    color: "#e0e0e8",
  },
  cancelFormBtn: {
    background: "none",
    border: "none",
    color: "#8888a0",
    cursor: "pointer",
    fontSize: 12,
    padding: "8px 0",
    fontFamily: "inherit",
    marginTop: 8,
  },
  formGrid: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  formRow: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  formLabel: {
    fontSize: 11,
    color: "#8888a0",
    fontWeight: 500,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  formInput: {
    background: "#0a0a0f",
    border: "1px solid #333",
    borderRadius: 6,
    color: "#e0e0e8",
    padding: "8px 10px",
    fontSize: 13,
    fontFamily: "inherit",
    outline: "none",
  },
  formTextarea: {
    background: "#0a0a0f",
    border: "1px solid #333",
    borderRadius: 6,
    color: "#e0e0e8",
    padding: "8px 10px",
    fontSize: 13,
    fontFamily: "inherit",
    outline: "none",
    resize: "vertical",
  },
  sourceRow: {
    display: "flex",
    gap: 8,
  },
  sourceBtn: {
    background: "none",
    border: "1px solid #333",
    borderRadius: 6,
    color: "#8888a0",
    cursor: "pointer",
    fontSize: 11,
    padding: "4px 12px",
    fontFamily: "inherit",
    fontWeight: 500,
  },
  sourceBtnActive: {
    background: "#7c3aed",
    borderColor: "#7c3aed",
    color: "#fff",
  },
  submitBtn: {
    background: "#7c3aed",
    border: "none",
    borderRadius: 6,
    color: "#fff",
    cursor: "pointer",
    fontSize: 13,
    padding: "10px 20px",
    fontFamily: "inherit",
    fontWeight: 600,
    marginTop: 4,
  },
};
