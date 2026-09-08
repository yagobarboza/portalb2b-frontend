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
    build: {
      // Code-splitting de vendor (B12): separa libs pesadas em chunks
      // cacheáveis, reduzindo o chunk inicial e melhorando o cache.
      rollupOptions: {
        output: {
          manualChunks: {
            react: ["react", "react-dom", "react-router-dom"],
            vendor: [
              "jspdf",
              "jspdf-autotable",
              "xlsx",
              "sonner",
              "date-fns",
            ],
          },
        },
      },
    },
  };
});