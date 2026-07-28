import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.DEV_CLIENT_PORT) || 5173,
    proxy: { "/api": process.env.DEV_API_PROXY_TARGET || "http://localhost:3001" },
  },
  build: {
    // "hidden" — source maps are generated (needed so client-side Sentry shows a real stack
    // instead of minified garbage), but WITHOUT a public //# sourceMappingURL in the built
    // file — maps aren't served to just anyone via express.static(client/dist).
    sourcemap: "hidden",
  },
});
