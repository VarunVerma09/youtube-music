import { useState, useEffect, useRef } from "react";
import { socket } from "../socket";
import type { ChatMessage } from "../types";

interface Props {
  messages: ChatMessage[];
  roomId: string;
  username: string;
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function Chat({ messages, roomId, username }: Props) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const msg = input.trim();
    if (!msg) return;
    socket.emit("chat_message", { roomId, message: msg });
    setInput("");
  };

  return (
    <div className="chat">
      <h3>Chat</h3>
      <div className="chat-messages">
        {messages.length === 0 && (
          <p className="chat-empty">No messages yet. Say hi!</p>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`chat-msg ${msg.username === username ? "chat-msg-own" : ""}`}>
            <div className="chat-msg-header">
              <span className="chat-user">{msg.username}</span>
              <span className="chat-time">{formatTimestamp(msg.timestamp)}</span>
            </div>
            <span className="chat-text">{msg.message}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form className="chat-form" onSubmit={sendMessage}>
        <input
          type="text"
          placeholder="Say something..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={300}
        />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}
