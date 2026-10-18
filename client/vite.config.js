import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In dev: proxy API + WebSocket to the Node backend on :3001
// In prod: the Node server serves this built bundle from the same origin,
// so no proxy is needed and wss:// points at the same host.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3001",
      "/ws": { target: "ws://localhost:3001", ws: true },
    },
  },
});
