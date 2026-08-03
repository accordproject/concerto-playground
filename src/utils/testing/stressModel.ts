/**
 * Deterministic stress-model generator for performance measurements.
 * Produces a valid CTO source with exactly `totalDeclarations` declarations,
 * mixing enums, scalars, maps and concepts (with inheritance and
 * relationships) so every node type appears in the graph.
 *
 * The output is stable for a given size, so measurements taken on different
 * days or machines exercise the same model.
 */
export function generateStressModel(totalDeclarations: number): string {
  if (totalDeclarations < 10) {
    throw new Error("generateStressModel needs at least 10 declarations");
  }

  const enums = Math.max(1, Math.round(totalDeclarations * 0.1));
  // Scalars come in string/number pairs; keep the count even.
  const scalars = Math.max(2, Math.round(totalDeclarations * 0.06) & ~1);
  const maps = Math.max(1, Math.round(totalDeclarations * 0.03));
  const concepts = totalDeclarations - enums - scalars - maps - 1; // -1 for BaseEntity

  const out: string[] = [];
  out.push(`namespace com.example.stress${totalDeclarations}@1.0.0`, "");

  const words = ["ACTIVE", "INACTIVE", "PENDING", "CLOSED", "DRAFT", "FINAL", "OPEN", "LOCKED"];
  for (let i = 0; i < enums; i++) {
    out.push(`enum Status${i} {`);
    for (let v = 0; v < 4; v++) out.push(`  o ${words[(i + v) % words.length]}_${v}`);
    out.push("}", "");
  }

  for (let i = 0; i < scalars; i++) {
    if (i % 2 === 0) out.push(`scalar Code${i} extends String regex=/^[A-Z]{2}-[0-9]{4}$/`, "");
    else out.push(`scalar Metric${i} extends Double range=[0.0, 1000.0]`, "");
  }

  for (let i = 0; i < maps; i++) {
    out.push(`map Lookup${i} {`, "  o String", `  o ${i % 2 === 0 ? "String" : "Integer"}`, "}", "");
  }

  out.push("abstract concept BaseEntity identified by id {");
  out.push("  o String id");
  out.push("  o DateTime createdAt");
  out.push("}", "");

  const codeScalars = scalars / 2;
  for (let i = 0; i < concepts; i++) {
    out.push(`concept Entity${i} extends BaseEntity {`);
    out.push("  o String name length=[1,80]");
    out.push(`  o Status${i % enums} status`);
    out.push(`  o Code${(i % codeScalars) * 2} code optional`);
    out.push("  o Integer version default=1");
    if (i % 5 === 0) out.push(`  o Lookup${i % maps} attributes optional`);
    if (i > 0) out.push(`  --> Entity${i - 1} previous optional`);
    if (i > 10) out.push(`  --> Entity${i % 10} hub optional`);
    out.push("}", "");
  }

  return out.join("\n");
}
