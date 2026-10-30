import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
  server: {
    port: 5190,
    // The API writes its SQLite file into data/; without this every answer reloads the page.
    watch: { ignored: ["**/data/**"] },
    proxy: { "/api": "http://localhost:8790" },
  },
});
