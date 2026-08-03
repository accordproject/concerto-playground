import { defineConfig } from "vitest/config";

// Separate config for the performance benchmarks in perf/. They are report
// only and slower than regular unit tests, so they run via `npm run perf:parse`
// instead of being picked up by the default `npm run test` suite.
export default defineConfig({
  test: {
    include: ["perf/**/*.perf.ts"],
    environment: "node",
    testTimeout: 120000,
  },
});
