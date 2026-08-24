import { describe, it, expect } from "vitest";
import { validateInBackground } from "../../utils/validationClient";

const VALID_CTO = `namespace test.valid@1.0.0

concept Thing identified by id {
  o String id
}`;

const BASE_CTO = `namespace test.base@1.0.0

abstract concept Base identified by id {
  o String id
}`;

const CHILD_CTO = `namespace test.child@1.0.0

import test.base@1.0.0.{ Base }

concept Child extends Base {
  o String name
}`;

// In this environment there is no Worker global, so these calls exercise the
// synchronous fallback; the promise-shaped contract is the same either way.
describe("validateInBackground", () => {
  it("resolves null for a valid model", async () => {
    await expect(validateInBackground(VALID_CTO)).resolves.toBeNull();
  });

  it("resolves an error message for a model with an unresolved type", async () => {
    const result = await validateInBackground(`namespace test.broken@1.0.0

concept Orphan extends Missing {
  o String name
}`);
    expect(typeof result).toBe("string");
    expect(result).toContain("Missing");
  });

  it("resolves null when the missing type is supplied by a peer namespace", async () => {
    await expect(validateInBackground(CHILD_CTO, [BASE_CTO])).resolves.toBeNull();
  });

  it("reports the error even for unparseable input instead of rejecting", async () => {
    const result = await validateInBackground("this is not concerto at all");
    expect(typeof result).toBe("string");
    expect(result!.length).toBeGreaterThan(0);
  });
});
