import React from "react";

export default function ChannelSidebar({ guild, channels, activeChannelId, onSelect, onCreate, user, onLogout }) {
  return (
    <div className="channel-sidebar">
      <div className="guild-header">{guild ? guild.name : "Discord Clone"}</div>

      {guild && (
        <div className="invite-box" title="Share this code so friends can join">
          <span>Invite:</span> <code>{guild.invite_code}</code>
        </div>
      )}

      <div className="channel-list">
        <div className="channel-list-label">
          Text channels
          {guild && (
            <button className="channel-add" title="Create channel" onClick={onCreate}>
              +
            </button>
          )}
        </div>
        {channels.length === 0 && <div className="channel-empty">No channels yet</div>}
        {channels.map((c) => (
          <button
            key={c.id}
            className={`channel-item ${activeChannelId === c.id ? "active" : ""}`}
            onClick={() => onSelect(c.id)}
          >
            <span className="hash">#</span> {c.name}
          </button>
        ))}
      </div>

      <div className="user-panel">
        <div className="avatar" style={{ background: user.avatar_color }}>
          {user.username[0]?.toUpperCase()}
        </div>
        <div className="user-panel-name">{user.username}</div>
        <button className="icon-btn" title="Log out" onClick={onLogout}>
          ⎋
        </button>
      </div>
    </div>
  );
}
