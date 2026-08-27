import { describe, expect, it } from "vitest";

export function computeNextDueDate(startDate: string, frequency: "semanal" | "mensal" | "anual", index: number): string {
  const dt = new Date(`${startDate}T00:00:00.000Z`);
  if (frequency === "semanal") {
    dt.setUTCDate(dt.getUTCDate() + index * 7);
  } else if (frequency === "mensal") {
    dt.setUTCMonth(dt.getUTCMonth() + index);
  } else {
    dt.setUTCFullYear(dt.getUTCFullYear() + index);
  }
  return dt.toISOString().split("T")[0];
}

describe("Task 10 - Recurrence Due Date Calculations", () => {
  it("calculates monthly due dates predictably", () => {
    expect(computeNextDueDate("2026-01-15", "mensal", 0)).toBe("2026-01-15");
    expect(computeNextDueDate("2026-01-15", "mensal", 1)).toBe("2026-02-15");
    expect(computeNextDueDate("2026-01-15", "mensal", 12)).toBe("2027-01-15");
  });

  it("calculates weekly due dates predictably", () => {
    expect(computeNextDueDate("2026-01-01", "semanal", 1)).toBe("2026-01-08");
    expect(computeNextDueDate("2026-01-01", "semanal", 4)).toBe("2026-01-29");
  });
});
