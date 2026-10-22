import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The page only ever calls /api on its own origin; Vite forwards that to the
// ministry's server, which is the one holding the Partner API credentials.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5180,
    proxy: { "/api": "http://127.0.0.1:5181" },
  },
});
