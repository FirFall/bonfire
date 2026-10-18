import React, { useState } from "react";
import { api, setToken } from "../api.js";

export default function Login({ onSuccess }) {
  const [mode, setMode] = useState("login"); // 'login' | 'register'
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res =
        mode === "login"
          ? await api.login(username, password)
          : await api.register(username, email, password);
      setToken(res.token);
      onSuccess(res.token, res.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={submit}>
        <h1>{mode === "login" ? "Welcome back!" : "Create an account"}</h1>
        <p className="login-sub">
          {mode === "login" ? "We're so excited to see you again!" : "Join the conversation"}
        </p>

        <label>Username</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoFocus
          required
        />

        {mode === "register" && (
          <>
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </>
        )}

        <label>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error && <div className="login-error">{error}</div>}

        <button className="btn-primary" disabled={busy}>
          {busy ? "..." : mode === "login" ? "Log In" : "Register"}
        </button>

        <div className="login-switch">
          {mode === "login" ? (
            <>
              Need an account?{" "}
              <a onClick={() => { setMode("register"); setError(null); }}>Register</a>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <a onClick={() => { setMode("login"); setError(null); }}>Log In</a>
            </>
          )}
        </div>
      </form>
    </div>
  );
}
