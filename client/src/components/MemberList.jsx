import React from "react";

export default function MemberList({ members, onlineIds }) {
  const sorted = [...members].sort((a, b) => {
    const aOn = onlineIds.has(a.id) ? 0 : 1;
    const bOn = onlineIds.has(b.id) ? 0 : 1;
    return aOn - bOn || a.username.localeCompare(b.username);
  });
  const onlineCount = members.filter((m) => onlineIds.has(m.id)).length;

  return (
    <div className="member-list">
      <div className="member-list-label">
        Members — {onlineCount}/{members.length} online
      </div>
      {sorted.map((m) => (
        <div key={m.id} className={`member ${onlineIds.has(m.id) ? "" : "offline"}`}>
          <div className="avatar small" style={{ background: m.avatar_color }}>
            {m.username[0]?.toUpperCase()}
          </div>
          <span className="member-name">{m.username}</span>
          {m.role === "owner" && <span className="owner-tag">OWNER</span>}
        </div>
      ))}
    </div>
  );
}
