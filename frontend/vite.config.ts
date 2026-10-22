import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In dev, any request to /api/... is forwarded to the FastAPI server,
// so the frontend can call fetch("/api/items") with no CORS setup.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8000",
    },
  },
});
