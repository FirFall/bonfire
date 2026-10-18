import React, { useEffect, useRef, useState } from "react";
import { api } from "../api.js";

function formatTime(iso) {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return sameDay ? `Today at ${time}` : `${d.toLocaleDateString()} ${time}`;
}

export default function Chat({ channel, messages, typing, onSend, onTyping }) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "auto" });
  }, [messages.length, channel?.id]);

  async function submit(e) {
    e.preventDefault();
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    try {
      await api.sendMessage(channel.id, content);
      setDraft("");
    } catch (err) {
      alert(err.message);
    } finally {
      setSending(false);
    }
  }

  function handleChange(e) {
    setDraft(e.target.value);
    onTyping();
  }

  if (!channel) {
    return (
      <div className="chat">
        <div className="chat-empty">
          <h2>Welcome to Discord Clone</h2>
          <p>Select a server on the left, or create one with the + button.</p>
        </div>
      </div>
    );
  }

  // Group consecutive messages by the same author within 5 minutes
  const grouped = messages.map((m, i) => {
    const prev = messages[i - 1];
    const grouped_ =
      prev &&
      prev.user_id === m.user_id &&
      new Date(m.created_at) - new Date(prev.created_at) < 5 * 60 * 1000;
    return { ...m, grouped: grouped_ };
  });

  return (
    <div className="chat">
      <div className="chat-header">
        <span className="hash"> #</span> {channel.name}
      </div>

      <div className="message-list">
        {grouped.length === 0 && (
          <div className="chat-empty">
            <h2>Welcome to #{channel.name}!</h2>
            <p>This is the start of the channel.</p>
          </div>
        )}
        {grouped.map((m) => (
          <div key={m.id} className={`message ${m.grouped ? "grouped" : ""}`}>
            {!m.grouped && (
              <>
                <div className="avatar" style={{ background: m.avatar_color }}>
                  {m.username[0]?.toUpperCase()}
                </div>
                <div className="message-meta">
                  <span className="message-author">{m.username}</span>
                  <span className="message-time">{formatTime(m.created_at)}</span>
                </div>
              </>
            )}
            <div className="message-content">{m.content}</div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {typing.length > 0 && (
        <div className="typing-indicator">
          <span className="typing-dots"><i /><i /><i /></span>
          {typing.length === 1 ? `${typing[0]} is typing...` : "Several people are typing..."}
        </div>
      )}

      <form className="chat-input-row" onSubmit={submit}>
        <input
          className="chat-input"
          placeholder={`Message #${channel.name}`}
          value={draft}
          onChange={handleChange}
          maxLength={2000}
        />
      </form>
    </div>
  );
}
