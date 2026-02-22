import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Proxy API calls from Vite dev server -> backend service (Docker network)
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://backend:5020",
        changeOrigin: true,
      },
      "/health": {
        target: "http://backend:5020",
        changeOrigin: true,
      },
    },
  },
});
