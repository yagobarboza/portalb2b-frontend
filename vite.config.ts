import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiUrl = env.VITE_API_URL ?? "http://localhost:8000/api/v1";

  let proxyTarget = apiUrl;
  try {
    proxyTarget = new URL(apiUrl).origin;
  } catch {
    proxyTarget = "http://localhost:8000";
  }

  return {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
    server: {
      proxy: {
        "/api": {
          target: proxyTarget,
          changeOrigin: true,
          ws: true, // WebSockets (/ws/{room_id})
        },
      },
    },
  };
});