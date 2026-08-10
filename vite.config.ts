import { defineConfig as defineViteConfig, mergeConfig } from "vite";
import { defineConfig as defineVitestConfig, configDefaults } from "vitest/config";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";

const viteConfig = defineViteConfig({
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
      "elkjs/lib/elk-api.js",
      "elkjs/lib/elk.bundled.js",
    ],
  },
  worker: {
    format: "es",
    // The validation worker bundles concerto-core too, so it needs the same
    // Node polyfills as the main bundle.
    plugins: () => [
      nodePolyfills({
        include: ["buffer", "process", "util", "stream", "events", "path"],
        globals: {
          Buffer: true,
          global: true,
          process: true,
        },
      }),
    ],
  },
  build: {
    target: "es2020",
  },
});

const vitestConfig = defineVitestConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: "./src/utils/testing/setup.ts",
    exclude: [...configDefaults.exclude, "**/e2e/**"],
    coverage: {
      provider: "v8",
      reporter: ["text"],
      include: ["src/**/*.{ts,tsx}"],
    },
  },
});

export default mergeConfig(viteConfig, vitestConfig);
