// CRC: crc-DashboardFrontend.md | CRC: crc-ThemeProvider.md | Seq: seq-event-flow.md
import { useState, useRef, useEffect, useMemo } from "react";
import { useTheme } from "../theme";
import { registerSkill, type ViewProps } from "../skills-registry";

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

// R358: Chat view with theme colors
export function Chat({ messages, send }: Props) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();

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
    <div style={{ display: "flex", flexDirection: "column" as const, height: "100%" }}>
      <div style={{ padding: "16px 20px", borderBottom: `1px solid ${theme.border}` }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: theme.text }}>Chat</h2>
        <span style={{ fontSize: 11, color: theme.textFaint, marginTop: 2, display: "block" }}>
          Messages flow through Claude Code via MCP
        </span>
      </div>

      <div style={{
        flex: 1,
        overflow: "auto",
        padding: "16px 20px",
        display: "flex",
        flexDirection: "column" as const,
        gap: 8,
      }}>
        {chatMessages.length === 0 && (
          <div style={{ color: theme.textFaint, fontSize: 13, textAlign: "center" as const, marginTop: 40 }}>
            No messages yet. Send a message to interact with Claude Code.
          </div>
        )}
        {chatMessages.map((msg, i) => {
          const isUser = msg.from === "user" || msg.from === "dashboard-user";
          return (
          <div key={i} style={{
            maxWidth: "80%",
            display: "flex",
            alignSelf: isUser ? "flex-end" : "flex-start",
          }}>
            <div style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid",
              fontSize: 13,
              lineHeight: 1.5,
              background: isUser ? theme.userBubbleBg : theme.border,
              borderColor: isUser ? theme.userBubbleBorder : theme.inputBorder,
            }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: theme.textMuted, marginBottom: 2 }}>
                {isUser ? "you" : msg.from}
              </div>
              <div style={{ color: theme.text, whiteSpace: "pre-wrap" as const, wordBreak: "break-word" as const }}>
                {msg.text}
              </div>
              <div style={{ fontSize: 10, color: theme.textFaint, marginTop: 4, textAlign: "right" as const }}>
                {new Date(msg.timestamp).toLocaleTimeString()}
              </div>
            </div>
          </div>
        );
        })}
        <div ref={bottomRef} />
      </div>

      <div style={{
        display: "flex",
        gap: 8,
        padding: "12px 20px",
        borderTop: `1px solid ${theme.border}`,
        background: theme.bg,
      }}>
        <input
          style={{
            flex: 1,
            padding: "10px 14px",
            background: theme.inputBg,
            border: `1px solid ${theme.inputBorder}`,
            borderRadius: 8,
            color: theme.text,
            fontSize: 13,
            fontFamily: "inherit",
            outline: "none",
          }}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Type a message..."
        />
        <button style={{
          padding: "10px 20px",
          background: theme.buttonBg,
          color: theme.buttonText,
          border: "none",
          borderRadius: 8,
          cursor: "pointer",
          fontWeight: 600,
          fontSize: 13,
          fontFamily: "inherit",
        }} onClick={handleSend}>
          Send
        </button>
      </div>
    </div>
  );
}

// R404: Self-register as sidebar skill at module scope
registerSkill({
  id: "chat",
  name: "Chat",
  icon: ">",
  surface: "sidebar",
  component: Chat as React.ComponentType<ViewProps>,
  order: 10,
  core: true,
});
