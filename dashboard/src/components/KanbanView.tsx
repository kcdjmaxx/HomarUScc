// CRC: crc-ThemeProvider.md
import { useState, useEffect, useCallback } from "react";
import { useTheme, type ThemePalette } from "../theme";
import { registerSkill, type ViewProps } from "../skills-registry";

interface Task {
  id: string;
  title: string;
  description: string;
  assignee: "caul" | "max";
  status: "todo" | "doing" | "done";
  created: string;
  updated: string;
}

type Status = "todo" | "doing" | "done";

const API = "/api/kanban/tasks";

const COLUMNS: Array<{ id: Status; label: string }> = [
  { id: "todo", label: "To Do" },
  { id: "doing", label: "In Progress" },
  { id: "done", label: "Done" },
];

function getAssigneeColors(theme: ThemePalette, isDark: boolean) {
  return {
    caul: {
      bg: isDark ? "#1a1a3e" : "#ede9fe",
      border: theme.accentSubtle,
      badge: theme.accent,
      text: theme.accent,
    },
    max: {
      bg: isDark ? "#1a2e1a" : "#f0fdf4",
      border: "#22c55e",
      badge: theme.success,
      text: theme.success,
    },
  };
}

// R362: KanbanView with theme colors
export function KanbanView() {
  const { theme, isDark } = useTheme();
  const ASSIGNEE_COLORS = getAssigneeColors(theme, isDark);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState<Status | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newAssignee, setNewAssignee] = useState<"caul" | "max">("max");
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch(API);
      const data = await res.json();
      setTasks(data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 10_000);
    return () => clearInterval(interval);
  }, [fetchTasks]);

  const createTask = async (status: Status) => {
    if (!newTitle.trim()) return;
    await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle, description: newDesc, assignee: newAssignee, status }),
    });
    setNewTitle("");
    setNewDesc("");
    setNewAssignee("max");
    setShowAdd(null);
    fetchTasks();
  };

  const updateTask = async (id: string, updates: Partial<Task>) => {
    await fetch(`${API}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    fetchTasks();
  };

  const deleteTask = async (id: string) => {
    await fetch(`${API}/${id}`, { method: "DELETE" });
    fetchTasks();
  };

  const moveTask = (task: Task, direction: "left" | "right") => {
    const order: Status[] = ["todo", "doing", "done"];
    const idx = order.indexOf(task.status);
    const newIdx = direction === "right" ? idx + 1 : idx - 1;
    if (newIdx < 0 || newIdx >= order.length) return;
    updateTask(task.id, { status: order[newIdx] });
  };

  const startEdit = (task: Task) => {
    setEditing(task.id);
    setEditTitle(task.title);
    setEditDesc(task.description);
  };

  const saveEdit = (id: string) => {
    updateTask(id, { title: editTitle, description: editDesc });
    setEditing(null);
  };

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

  const textareaStyle: React.CSSProperties = {
    ...inputStyle,
    fontSize: 12,
    resize: "vertical" as const,
  };

  return (
    <div style={{ padding: 20, height: "100%", overflow: "auto", display: "flex", flexDirection: "column" as const }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: theme.text }}>Kanban</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", display: "inline-block", background: ASSIGNEE_COLORS.caul.badge }} />
          <span style={{ color: theme.textMuted }}>Caul</span>
          <span style={{ width: 10, height: 10, borderRadius: "50%", display: "inline-block", background: ASSIGNEE_COLORS.max.badge, marginLeft: 12 }} />
          <span style={{ color: theme.textMuted }}>Max</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 16, flex: 1, minHeight: 0 }}>
        {COLUMNS.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.id);
          return (
            <div key={col.id} style={{
              flex: 1,
              minWidth: 0,
              background: theme.surface,
              borderRadius: 10,
              padding: 12,
              display: "flex",
              flexDirection: "column" as const,
            }}>
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
                paddingBottom: 8,
                borderBottom: `1px solid ${theme.border}`,
              }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: theme.textMuted, textTransform: "uppercase" as const, letterSpacing: 1 }}>
                  {col.label}
                </span>
                <span style={{
                  fontSize: 11,
                  color: theme.textFaint,
                  background: theme.border,
                  borderRadius: 10,
                  padding: "2px 8px",
                }}>{colTasks.length}</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column" as const, gap: 8, flex: 1, overflow: "auto" }}>
                {colTasks.map((task) => {
                  const colors = ASSIGNEE_COLORS[task.assignee];
                  const isEditing = editing === task.id;

                  return (
                    <div
                      key={task.id}
                      style={{
                        borderRadius: 8,
                        padding: 10,
                        background: colors.bg,
                        borderLeft: `3px solid ${colors.border}`,
                      }}
                    >
                      {isEditing ? (
                        <div style={{ display: "flex", flexDirection: "column" as const, gap: 6 }}>
                          <input
                            style={inputStyle}
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && saveEdit(task.id)}
                            autoFocus
                          />
                          <textarea
                            style={textareaStyle}
                            value={editDesc}
                            onChange={(e) => setEditDesc(e.target.value)}
                            rows={2}
                          />
                          <div style={{ display: "flex", gap: 6 }}>
                            <button style={{ background: theme.buttonBg, border: "none", borderRadius: 6, color: theme.buttonText, cursor: "pointer", fontSize: 12, padding: "6px 16px", fontFamily: "inherit", fontWeight: 600 }} onClick={() => saveEdit(task.id)}>Save</button>
                            <button style={{ background: "none", border: `1px solid ${theme.inputBorder}`, borderRadius: 6, color: theme.textMuted, cursor: "pointer", fontSize: 12, padding: "6px 16px", fontFamily: "inherit" }} onClick={() => setEditing(null)}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                            <span style={{
                              fontSize: 10,
                              fontWeight: 700,
                              padding: "2px 8px",
                              borderRadius: 10,
                              textTransform: "uppercase" as const,
                              letterSpacing: 0.5,
                              background: colors.badge,
                              color: isDark ? theme.bg : "#fff",
                            }}>
                              {task.assignee}
                            </span>
                            <div style={{ display: "flex", gap: 4 }}>
                              {col.id !== "todo" && (
                                <button style={{ background: "none", border: `1px solid ${theme.inputBorder}`, borderRadius: 4, color: theme.textMuted, cursor: "pointer", fontSize: 12, padding: "2px 6px", fontFamily: "inherit" }} onClick={() => moveTask(task, "left")} title="Move left">&larr;</button>
                              )}
                              {col.id !== "done" && (
                                <button style={{ background: "none", border: `1px solid ${theme.inputBorder}`, borderRadius: 4, color: theme.textMuted, cursor: "pointer", fontSize: 12, padding: "2px 6px", fontFamily: "inherit" }} onClick={() => moveTask(task, "right")} title="Move right">&rarr;</button>
                              )}
                            </div>
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: theme.text, marginBottom: 4 }}>{task.title}</div>
                          {task.description && (
                            <div style={{ fontSize: 11, color: theme.textMuted, lineHeight: 1.4, marginBottom: 8 }}>{task.description}</div>
                          )}
                          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                            <button style={{ background: "none", border: `1px solid ${theme.inputBorder}`, borderRadius: 4, color: theme.textMuted, cursor: "pointer", fontSize: 10, padding: "3px 8px", fontFamily: "inherit" }} onClick={() => startEdit(task)}>Edit</button>
                            <button
                              style={{ background: "none", border: `1px solid ${theme.inputBorder}`, borderRadius: 4, color: theme.textMuted, cursor: "pointer", fontSize: 10, padding: "3px 8px", fontFamily: "inherit" }}
                              onClick={() => updateTask(task.id, { assignee: task.assignee === "caul" ? "max" : "caul" })}
                            >
                              &rarr; {task.assignee === "caul" ? "Max" : "Caul"}
                            </button>
                            <button style={{ background: "none", border: `1px solid ${theme.errorSubtle}`, borderRadius: 4, color: theme.error, cursor: "pointer", fontSize: 10, padding: "3px 8px", fontFamily: "inherit", marginLeft: "auto" }} onClick={() => deleteTask(task.id)}>Delete</button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}

                {showAdd === col.id ? (
                  <div style={{ background: theme.border, borderRadius: 8, padding: 10, display: "flex", flexDirection: "column" as const, gap: 8 }}>
                    <input
                      style={inputStyle}
                      placeholder="Task title..."
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && createTask(col.id)}
                      autoFocus
                    />
                    <textarea
                      style={textareaStyle}
                      placeholder="Description (optional)"
                      value={newDesc}
                      onChange={(e) => setNewDesc(e.target.value)}
                      rows={2}
                    />
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <label style={{ fontSize: 11, color: theme.textMuted }}>Assign to:</label>
                      <button
                        style={{
                          border: `1px solid ${theme.inputBorder}`,
                          borderRadius: 6,
                          cursor: "pointer",
                          fontSize: 11,
                          padding: "4px 12px",
                          fontFamily: "inherit",
                          fontWeight: 600,
                          background: newAssignee === "max" ? ASSIGNEE_COLORS.max.badge : "transparent",
                          color: newAssignee === "max" ? (isDark ? theme.bg : "#fff") : theme.textMuted,
                        }}
                        onClick={() => setNewAssignee("max")}
                      >
                        Max
                      </button>
                      <button
                        style={{
                          border: `1px solid ${theme.inputBorder}`,
                          borderRadius: 6,
                          cursor: "pointer",
                          fontSize: 11,
                          padding: "4px 12px",
                          fontFamily: "inherit",
                          fontWeight: 600,
                          background: newAssignee === "caul" ? ASSIGNEE_COLORS.caul.badge : "transparent",
                          color: newAssignee === "caul" ? (isDark ? theme.bg : "#fff") : theme.textMuted,
                        }}
                        onClick={() => setNewAssignee("caul")}
                      >
                        Caul
                      </button>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button style={{ background: theme.buttonBg, border: "none", borderRadius: 6, color: theme.buttonText, cursor: "pointer", fontSize: 12, padding: "6px 16px", fontFamily: "inherit", fontWeight: 600 }} onClick={() => createTask(col.id)}>Add</button>
                      <button style={{ background: "none", border: `1px solid ${theme.inputBorder}`, borderRadius: 6, color: theme.textMuted, cursor: "pointer", fontSize: 12, padding: "6px 16px", fontFamily: "inherit" }} onClick={() => setShowAdd(null)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button style={{
                    background: "none",
                    border: `1px dashed ${theme.inputBorder}`,
                    borderRadius: 8,
                    color: theme.textFaint,
                    cursor: "pointer",
                    fontSize: 12,
                    padding: "10px",
                    fontFamily: "inherit",
                    marginTop: 4,
                  }} onClick={() => setShowAdd(col.id)}>+ Add task</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// R404: Self-register as sidebar skill at module scope (R420: ignores ViewProps)
registerSkill({
  id: "kanban",
  name: "Kanban",
  icon: "=",
  surface: "sidebar",
  component: KanbanView as unknown as React.ComponentType<ViewProps>,
  order: 50,
  core: false,
});
