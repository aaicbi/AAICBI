import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  // Components are written for Next's automatic JSX runtime (no React import), so tests that render them need the same.
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
  },
});
