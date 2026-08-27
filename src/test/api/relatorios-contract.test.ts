import { describe, expect, it } from "vitest";

export function calculateSummaryTotals(records: Array<{ tipo: "receita" | "despesa" | "transferencia"; valorPago: number }>): {
  totalReceita: number;
  totalDespesa: number;
  saldoPeriodo: number;
} {
  let totalReceita = 0;
  let totalDespesa = 0;

  for (const record of records) {
    if (record.tipo === "receita") {
      totalReceita += record.valorPago;
    } else if (record.tipo === "despesa") {
      totalDespesa += record.valorPago;
    }
  }

  return {
    totalReceita: Number(totalReceita.toFixed(2)),
    totalDespesa: Number(totalDespesa.toFixed(2)),
    saldoPeriodo: Number((totalReceita - totalDespesa).toFixed(2)),
  };
}

describe("Task 12 - Report Aggregations", () => {
  it("excludes transfer records from operational income/expense totals", () => {
    const res = calculateSummaryTotals([
      { tipo: "receita", valorPago: 1000 },
      { tipo: "despesa", valorPago: 400 },
      { tipo: "transferencia", valorPago: 500 },
    ]);

    expect(res.totalReceita).toBe(1000);
    expect(res.totalDespesa).toBe(400);
    expect(res.saldoPeriodo).toBe(600);
  });
});
