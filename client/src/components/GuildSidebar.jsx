import React from "react";

function initials(name) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function GuildSidebar({ guilds, activeGuildId, onSelect, onCreate, onJoin }) {
  return (
    <div className="guild-sidebar">
      <button
        className={`guild-icon home ${activeGuildId === null ? "active" : ""}`}
        title="Direct Messages"
        onClick={() => onSelect(null)}
      >
        ◈
      </button>
      <div className="guild-divider" />
      {guilds.map((g) => (
        <button
          key={g.id}
          className={`guild-icon ${activeGuildId === g.id ? "active" : ""}`}
          title={g.name}
          onClick={() => onSelect(g.id)}
        >
          {initials(g.name)}
        </button>
      ))}
      <div className="guild-divider" />
      <button className="guild-icon add" title="Create a server" onClick={onCreate}>
        +
      </button>
      <button className="guild-icon add" title="Join with invite code" onClick={onJoin}>
        ⤵
      </button>
    </div>
  );
}
