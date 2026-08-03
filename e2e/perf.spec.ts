import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import LZString from "lz-string";
import { generateStressModel } from "../src/utils/testing/stressModel";

/**
 * Report-only performance measurements in a real (headless) browser.
 *
 * For each model size this loads the app with the stress model injected via
 * the share-URL hash, then measures:
 *  - time from navigation until the first graph node is visible
 *  - number of React Flow nodes present in the DOM
 *  - a typing burst: React commit durations for the editor and graph
 *    subtrees (via window.__us07PerfLog, see App.tsx) and main-thread long
 *    tasks (via PerformanceObserver)
 *
 * Run with: npm run perf:e2e
 * Numbers are printed as a table and appended as JSON under perf-results/.
 * No assertions are made on timings: dev-server React plus machine noise make
 * absolute values unstable, so this is a trend instrument, not a gate.
 */

const SIZES = [100, 500, 1000];

// Matches the manual measurement protocol: throttle the CPU 4x so the numbers
// reflect a slower user machine and problems are easier to see.
const CPU_THROTTLE = 4;

interface SizeResult {
  declarations: number;
  msToFirstNode: number;
  domNodeCount: number;
  editorCommits: number;
  editorMaxMs: number;
  graphCommits: number;
  graphMaxMs: number;
  graphTotalMs: number;
  longTasks: number;
  longestTaskMs: number;
}

const results: SizeResult[] = [];

test.describe.configure({ mode: "serial" });

test.describe("US-07 perf measurements (report only)", () => {
  for (const size of SIZES) {
    test(`model with ${size} declarations`, async ({ page, browser }) => {
      test.setTimeout(300000);
      const cto = generateStressModel(size);
      const hash = LZString.compressToEncodedURIComponent(cto);

      const cdp = await page.context().newCDPSession(page);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU_THROTTLE });

      await page.addInitScript(() => {
        const w = window as unknown as { __us07LongTasks: number[] };
        w.__us07LongTasks = [];
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) w.__us07LongTasks.push(entry.duration);
        }).observe({ type: "longtask", buffered: true });
      });

      const navStart = Date.now();
      await page.goto("/#" + hash);
      await page.locator(".react-flow__node").first().waitFor({ state: "visible", timeout: 240000 });
      const msToFirstNode = Date.now() - navStart;

      // Let initial rendering settle so the typing burst measures typing only.
      await page.waitForTimeout(2000);
      const domNodeCount = await page.locator(".react-flow__node").count();

      // Monaco loads asynchronously; wait for the editor and its global API.
      await page.locator(".monaco-editor").first().waitFor({ state: "visible", timeout: 60000 });
      await page.waitForFunction(
        () => {
          const w = window as unknown as { monaco?: { editor?: { getEditors: () => unknown[] } } };
          return (w.monaco?.editor?.getEditors()?.length ?? 0) > 0;
        },
        { timeout: 60000 },
      );

      // Place the cursor right after "Entity1" in the source and extend the
      // name letter by letter: every keystroke keeps the model parseable, so
      // each one exercises the full parse-and-rebuild path.
      await page.evaluate(() => {
        const w = window as unknown as {
          monaco: any;
          __us07PerfLog: unknown[];
          __us07LongTasks: number[];
        };
        const editor = w.monaco.editor.getEditors()[0];
        const model = editor.getModel();
        const match = model.findMatches("concept Entity1 ", false, false, true, null, false)[0];
        editor.setPosition({ lineNumber: match.range.endLineNumber, column: match.range.endColumn - 1 });
        editor.focus();
        w.__us07PerfLog.length = 0;
        w.__us07LongTasks.length = 0;
      });

      // Record a DevTools-loadable trace around the typing burst. The file
      // can be opened in the Performance panel (load arrow) to inspect and
      // screenshot the long tasks without re-measuring by hand.
      const traceDir = path.resolve(process.cwd(), "perf-results");
      fs.mkdirSync(traceDir, { recursive: true });
      const tracePath = path.join(traceDir, `trace_typing_${size}decl.json`);
      await browser.startTracing(page, { path: tracePath, screenshots: true });

      await page.keyboard.type("abcdefghij", { delay: 80 });
      await page.waitForTimeout(2000);

      await browser.stopTracing();

      const measured = await page.evaluate(() => {
        const w = window as unknown as {
          __us07PerfLog: { id: string; phase: string; actualDuration: number }[];
          __us07LongTasks: number[];
        };
        const commits = w.__us07PerfLog.filter((e) => e.phase !== "mount");
        const byId = (id: string) => commits.filter((e) => e.id === id).map((e) => e.actualDuration);
        const editor = byId("cto-editor");
        const graph = byId("graph");
        const max = (xs: number[]) => (xs.length ? Math.max(...xs) : 0);
        const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
        return {
          editorCommits: editor.length,
          editorMaxMs: +max(editor).toFixed(1),
          graphCommits: graph.length,
          graphMaxMs: +max(graph).toFixed(1),
          graphTotalMs: +sum(graph).toFixed(1),
          longTasks: w.__us07LongTasks.length,
          longestTaskMs: +max(w.__us07LongTasks).toFixed(0),
        };
      });

      results.push({ declarations: size, msToFirstNode, domNodeCount, ...measured });

      // Sanity only: the app loaded and produced a graph. Never a timing gate.
      expect(domNodeCount).toBeGreaterThan(0);
    });
  }

  test.afterAll(() => {
    if (results.length === 0) return;
    console.table(results);
    // Playwright runs specs as ESM (no __dirname); the working directory is
    // the project root.
    const outDir = path.resolve(process.cwd(), "perf-results");
    fs.mkdirSync(outDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const outFile = path.join(outDir, `e2e_${stamp}.json`);
    fs.writeFileSync(
      outFile,
      JSON.stringify(
        {
          capturedAt: new Date().toISOString(),
          kind: "e2e-perf",
          note: "dev server, headless Chromium, report only",
          cpuThrottling: CPU_THROTTLE,
          results,
        },
        null,
        2,
      ),
    );
    console.log(`Results written to ${outFile}`);
  });
});
