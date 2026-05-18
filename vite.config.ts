import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      include: ["buffer", "process", "util", "stream", "events", "path"],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
  ],
  optimizeDeps: {
    include: [
      "@accordproject/concerto-core",
      "@accordproject/concerto-cto",
      "@accordproject/concerto-codegen",
    ],
  },
  build: {
    target: "es2020",
  },
});
