import { useState, useEffect, useCallback } from "react";

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

const ASSIGNEE_COLORS = {
  caul: { bg: "#1a1a3e", border: "#7c3aed", badge: "#c4b5fd", text: "#c4b5fd" },
  max: { bg: "#1a2e1a", border: "#22c55e", badge: "#4ade80", text: "#4ade80" },
};

export function KanbanView() {
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

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.heading}>Kanban</h2>
        <div style={styles.legend}>
          <span style={{ ...styles.legendDot, background: ASSIGNEE_COLORS.caul.badge }} />
          <span style={styles.legendLabel}>Caul</span>
          <span style={{ ...styles.legendDot, background: ASSIGNEE_COLORS.max.badge, marginLeft: 12 }} />
          <span style={styles.legendLabel}>Max</span>
        </div>
      </div>

      <div style={styles.board}>
        {COLUMNS.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.id);
          return (
            <div key={col.id} style={styles.column}>
              <div style={styles.colHeader}>
                <span style={styles.colTitle}>{col.label}</span>
                <span style={styles.colCount}>{colTasks.length}</span>
              </div>

              <div style={styles.cardList}>
                {colTasks.map((task) => {
                  const colors = ASSIGNEE_COLORS[task.assignee];
                  const isEditing = editing === task.id;

                  return (
                    <div
                      key={task.id}
                      style={{
                        ...styles.card,
                        background: colors.bg,
                        borderLeft: `3px solid ${colors.border}`,
                      }}
                    >
                      {isEditing ? (
                        <div style={styles.editForm}>
                          <input
                            style={styles.editInput}
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && saveEdit(task.id)}
                            autoFocus
                          />
                          <textarea
                            style={styles.editTextarea}
                            value={editDesc}
                            onChange={(e) => setEditDesc(e.target.value)}
                            rows={2}
                          />
                          <div style={styles.editActions}>
                            <button style={styles.btnSave} onClick={() => saveEdit(task.id)}>Save</button>
                            <button style={styles.btnCancel} onClick={() => setEditing(null)}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div style={styles.cardTop}>
                            <span
                              style={{ ...styles.badge, background: colors.badge, color: "#0a0a0f" }}
                            >
                              {task.assignee}
                            </span>
                            <div style={styles.cardActions}>
                              {col.id !== "todo" && (
                                <button style={styles.moveBtn} onClick={() => moveTask(task, "left")} title="Move left">&larr;</button>
                              )}
                              {col.id !== "done" && (
                                <button style={styles.moveBtn} onClick={() => moveTask(task, "right")} title="Move right">&rarr;</button>
                              )}
                            </div>
                          </div>
                          <div style={styles.cardTitle}>{task.title}</div>
                          {task.description && (
                            <div style={styles.cardDesc}>{task.description}</div>
                          )}
                          <div style={styles.cardFooter}>
                            <button style={styles.btnEdit} onClick={() => startEdit(task)}>Edit</button>
                            <button
                              style={styles.btnEdit}
                              onClick={() => updateTask(task.id, { assignee: task.assignee === "caul" ? "max" : "caul" })}
                            >
                              &rarr; {task.assignee === "caul" ? "Max" : "Caul"}
                            </button>
                            <button style={styles.btnDelete} onClick={() => deleteTask(task.id)}>Delete</button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}

                {showAdd === col.id ? (
                  <div style={styles.addForm}>
                    <input
                      style={styles.addInput}
                      placeholder="Task title..."
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && createTask(col.id)}
                      autoFocus
                    />
                    <textarea
                      style={styles.addTextarea}
                      placeholder="Description (optional)"
                      value={newDesc}
                      onChange={(e) => setNewDesc(e.target.value)}
                      rows={2}
                    />
                    <div style={styles.assigneeRow}>
                      <label style={styles.assigneeLabel}>Assign to:</label>
                      <button
                        style={{
                          ...styles.assigneeBtn,
                          background: newAssignee === "max" ? ASSIGNEE_COLORS.max.badge : "transparent",
                          color: newAssignee === "max" ? "#0a0a0f" : "#8888a0",
                        }}
                        onClick={() => setNewAssignee("max")}
                      >
                        Max
                      </button>
                      <button
                        style={{
                          ...styles.assigneeBtn,
                          background: newAssignee === "caul" ? ASSIGNEE_COLORS.caul.badge : "transparent",
                          color: newAssignee === "caul" ? "#0a0a0f" : "#8888a0",
                        }}
                        onClick={() => setNewAssignee("caul")}
                      >
                        Caul
                      </button>
                    </div>
                    <div style={styles.addActions}>
                      <button style={styles.btnSave} onClick={() => createTask(col.id)}>Add</button>
                      <button style={styles.btnCancel} onClick={() => setShowAdd(null)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button style={styles.addBtn} onClick={() => setShowAdd(col.id)}>+ Add task</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
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
    justifyContent: "space-between",
    marginBottom: 20,
  },
  heading: {
    margin: 0,
    fontSize: 18,
    fontWeight: 600,
    color: "#e0e0e8",
  },
  legend: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    display: "inline-block",
  },
  legendLabel: {
    color: "#8888a0",
  },
  board: {
    display: "flex",
    gap: 16,
    flex: 1,
    minHeight: 0,
  },
  column: {
    flex: 1,
    minWidth: 0,
    background: "#12121a",
    borderRadius: 10,
    padding: 12,
    display: "flex",
    flexDirection: "column",
  },
  colHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingBottom: 8,
    borderBottom: "1px solid #1e1e2e",
  },
  colTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: "#8888a0",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  colCount: {
    fontSize: 11,
    color: "#555",
    background: "#1e1e2e",
    borderRadius: 10,
    padding: "2px 8px",
  },
  cardList: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    flex: 1,
    overflow: "auto",
  },
  card: {
    borderRadius: 8,
    padding: 10,
  },
  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  badge: {
    fontSize: 10,
    fontWeight: 700,
    padding: "2px 8px",
    borderRadius: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  cardActions: {
    display: "flex",
    gap: 4,
  },
  moveBtn: {
    background: "none",
    border: "1px solid #333",
    borderRadius: 4,
    color: "#8888a0",
    cursor: "pointer",
    fontSize: 12,
    padding: "2px 6px",
    fontFamily: "inherit",
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: "#e0e0e8",
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 11,
    color: "#8888a0",
    lineHeight: 1.4,
    marginBottom: 8,
  },
  cardFooter: {
    display: "flex",
    gap: 6,
    marginTop: 6,
  },
  btnEdit: {
    background: "none",
    border: "1px solid #333",
    borderRadius: 4,
    color: "#8888a0",
    cursor: "pointer",
    fontSize: 10,
    padding: "3px 8px",
    fontFamily: "inherit",
  },
  btnDelete: {
    background: "none",
    border: "1px solid #4a1a1a",
    borderRadius: 4,
    color: "#f87171",
    cursor: "pointer",
    fontSize: 10,
    padding: "3px 8px",
    fontFamily: "inherit",
    marginLeft: "auto",
  },
  addBtn: {
    background: "none",
    border: "1px dashed #333",
    borderRadius: 8,
    color: "#555",
    cursor: "pointer",
    fontSize: 12,
    padding: "10px",
    fontFamily: "inherit",
    marginTop: 4,
  },
  addForm: {
    background: "#1e1e2e",
    borderRadius: 8,
    padding: 10,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  addInput: {
    background: "#0a0a0f",
    border: "1px solid #333",
    borderRadius: 6,
    color: "#e0e0e8",
    padding: "8px 10px",
    fontSize: 13,
    fontFamily: "inherit",
    outline: "none",
  },
  addTextarea: {
    background: "#0a0a0f",
    border: "1px solid #333",
    borderRadius: 6,
    color: "#e0e0e8",
    padding: "8px 10px",
    fontSize: 12,
    fontFamily: "inherit",
    outline: "none",
    resize: "vertical" as const,
  },
  assigneeRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  assigneeLabel: {
    fontSize: 11,
    color: "#8888a0",
  },
  assigneeBtn: {
    border: "1px solid #333",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 11,
    padding: "4px 12px",
    fontFamily: "inherit",
    fontWeight: 600,
  },
  addActions: {
    display: "flex",
    gap: 8,
  },
  btnSave: {
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
  btnCancel: {
    background: "none",
    border: "1px solid #333",
    borderRadius: 6,
    color: "#8888a0",
    cursor: "pointer",
    fontSize: 12,
    padding: "6px 16px",
    fontFamily: "inherit",
  },
  editForm: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  editInput: {
    background: "#0a0a0f",
    border: "1px solid #444",
    borderRadius: 4,
    color: "#e0e0e8",
    padding: "6px 8px",
    fontSize: 13,
    fontFamily: "inherit",
    outline: "none",
  },
  editTextarea: {
    background: "#0a0a0f",
    border: "1px solid #444",
    borderRadius: 4,
    color: "#e0e0e8",
    padding: "6px 8px",
    fontSize: 12,
    fontFamily: "inherit",
    outline: "none",
    resize: "vertical" as const,
  },
  editActions: {
    display: "flex",
    gap: 6,
  },
};
