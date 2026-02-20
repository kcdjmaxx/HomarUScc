import { useState, useRef, useEffect, useMemo } from "react";

interface WsMessage {
  type: string;
  payload: unknown;
}

interface ChatMessage {
  from: string;
  text: string;
  timestamp: number;
}

interface Props {
  messages: WsMessage[];
  send: (type: string, payload: unknown) => void;
}

export function Chat({ messages, send }: Props) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const chatMessages = useMemo(() => {
    return messages
      .filter((m) => m.type === "chat")
      .map((m) => m.payload as ChatMessage);
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleSend = () => {
    if (!input.trim()) return;
    send("chat", { text: input });
    setInput("");
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Chat</h2>
        <span style={styles.subtitle}>Messages flow through Claude Code via MCP</span>
      </div>

      <div style={styles.messages}>
        {chatMessages.length === 0 && (
          <div style={styles.empty}>
            No messages yet. Send a message to interact with Claude Code.
          </div>
        )}
        {chatMessages.map((msg, i) => (
          <div key={i} style={{
            ...styles.message,
            alignSelf: msg.from === "dashboard-user" ? "flex-end" : "flex-start",
          }}>
            <div style={{
              ...styles.bubble,
              background: msg.from === "dashboard-user" ? "#2e1065" : "#1e1e2e",
              borderColor: msg.from === "dashboard-user" ? "#7c3aed" : "#2e2e3e",
            }}>
              <div style={styles.msgFrom}>{msg.from}</div>
              <div style={styles.msgText}>{msg.text}</div>
              <div style={styles.msgTime}>
                {new Date(msg.timestamp).toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div style={styles.inputArea}>
        <input
          style={styles.input}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Type a message..."
        />
        <button style={styles.sendBtn} onClick={handleSend}>
          Send
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    flexDirection: "column" as const,
    height: "100%",
  },
  header: {
    padding: "16px 20px",
    borderBottom: "1px solid #1e1e2e",
  },
  title: {
    margin: 0,
    fontSize: 16,
    fontWeight: 600,
    color: "#e0e0e8",
  },
  subtitle: {
    fontSize: 11,
    color: "#6b6b80",
    marginTop: 2,
    display: "block",
  },
  messages: {
    flex: 1,
    overflow: "auto",
    padding: "16px 20px",
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
  },
  empty: {
    color: "#6b6b80",
    fontSize: 13,
    textAlign: "center" as const,
    marginTop: 40,
  },
  message: {
    maxWidth: "80%",
    display: "flex",
  },
  bubble: {
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid",
    fontSize: 13,
    lineHeight: 1.5,
  },
  msgFrom: {
    fontSize: 10,
    fontWeight: 600,
    color: "#8888a0",
    marginBottom: 2,
  },
  msgText: {
    color: "#e0e0e8",
    whiteSpace: "pre-wrap" as const,
    wordBreak: "break-word" as const,
  },
  msgTime: {
    fontSize: 10,
    color: "#555568",
    marginTop: 4,
    textAlign: "right" as const,
  },
  inputArea: {
    display: "flex",
    gap: 8,
    padding: "12px 20px",
    borderTop: "1px solid #1e1e2e",
    background: "#0e0e16",
  },
  input: {
    flex: 1,
    padding: "10px 14px",
    background: "#1a1a24",
    border: "1px solid #2e2e3e",
    borderRadius: 8,
    color: "#e0e0e8",
    fontSize: 13,
    fontFamily: "inherit",
    outline: "none",
  },
  sendBtn: {
    padding: "10px 20px",
    background: "#7c3aed",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 13,
    fontFamily: "inherit",
  },
};
