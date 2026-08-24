import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parseCto, declarationsToGraph } from "../src/utils/graph/ctoToGraph";
import { generateStressModel } from "../src/utils/testing/stressModel";

/**
 * Report-only benchmark for the CPU-heavy pure functions on the editing path:
 * parseCto (CTO source to declarations) and declarationsToGraph (declarations
 * to React Flow nodes and edges). These two run on every accepted editor
 * change, so their cost bounds how fast the canvas can ever react to typing.
 *
 * Run with: npm run perf:parse
 * Results are printed as a table and appended as JSON under perf-results/.
 */

const SIZES = [100, 500, 1000];
const RUNS = 7;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

describe("CTO parse and graph build benchmark (report only)", () => {
  it("measures parseCto and declarationsToGraph across model sizes", () => {
    const results = SIZES.map((size) => {
      const cto = generateStressModel(size);
      // Warm-up run so JIT compilation does not land in the measured runs.
      declarationsToGraph(parseCto(cto).declarations);

      const parseTimes: number[] = [];
      const graphTimes: number[] = [];
      for (let run = 0; run < RUNS; run++) {
        const t0 = performance.now();
        const model = parseCto(cto);
        const t1 = performance.now();
        declarationsToGraph(model.declarations);
        const t2 = performance.now();
        parseTimes.push(t1 - t0);
        graphTimes.push(t2 - t1);
      }

      return {
        declarations: size,
        sourceLines: cto.split("\n").length,
        parseMedianMs: +median(parseTimes).toFixed(1),
        graphMedianMs: +median(graphTimes).toFixed(1),
        totalMedianMs: +(median(parseTimes) + median(graphTimes)).toFixed(1),
        runs: RUNS,
      };
    });

    console.table(results);

    const outDir = path.resolve(__dirname, "..", "perf-results");
    fs.mkdirSync(outDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const outFile = path.join(outDir, `parse_${stamp}.json`);
    fs.writeFileSync(
      outFile,
      JSON.stringify({ capturedAt: new Date().toISOString(), kind: "parse-benchmark", results }, null, 2),
    );
    console.log(`Results written to ${outFile}`);

    // Report only: the single assertion is a sanity check that work happened,
    // never a performance threshold.
    expect(results).toHaveLength(SIZES.length);
  });
});
