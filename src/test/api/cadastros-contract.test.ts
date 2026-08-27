import { describe, expect, it } from "vitest";

export function detectCategoryCycle(
  targetId: string,
  newParentId: string | null,
  hierarchy: Record<string, string | null>
): boolean {
  if (!newParentId) return false;
  if (targetId === newParentId) return true;

  let curr: string | null = newParentId;
  const visited = new Set<string>();

  while (curr) {
    if (curr === targetId) return true;
    if (visited.has(curr)) return true; // Cycle inside ancestors
    visited.add(curr);
    curr = hierarchy[curr] ?? null;
  }

  return false;
}

describe("Task 13 - Category Hierarchy Cycle Protection", () => {
  it("prevents setting category as its own parent", () => {
    expect(detectCategoryCycle("cat-1", "cat-1", {})).toBe(true);
  });

  it("detects multi-level cycles", () => {
    const hierarchy = {
      "cat-2": "cat-3",
      "cat-3": "cat-1", // cat-3 -> cat-1 -> cat-2 -> cat-3...
    };
    expect(detectCategoryCycle("cat-1", "cat-2", hierarchy)).toBe(true);
  });

  it("allows valid non-cyclic re-parenting", () => {
    const hierarchy = {
      "cat-2": "cat-3",
      "cat-3": null,
    };
    expect(detectCategoryCycle("cat-1", "cat-2", hierarchy)).toBe(false);
  });
});
