import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Disable remote bindings by default so local `pnpm dev` works without
    // CLOUDFLARE_API_TOKEN. Enable when authenticated to use Workers AI / AI Search.
    cloudflare({ remoteBindings: false }),
  ],
  resolve: {
    alias: {
      "@shared": path.resolve(root, "./shared"),
      "@client": path.resolve(root, "./client"),
      "@worker": path.resolve(root, "./worker"),
    },
  },
  build: {
    sourcemap: true,
  },
});
