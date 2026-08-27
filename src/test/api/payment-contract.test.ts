import { describe, expect, it } from "vitest";
import { deriveLancamentoStatus, validatePaymentMovement } from "../../../supabase/functions/_shared/payment-rules.js";

describe("Task 7 - Payment & Receipt Movement Rules", () => {
  it("rejects non-positive payment amounts", () => {
    expect(validatePaymentMovement(100, 0, 0).valid).toBe(false);
    expect(validatePaymentMovement(100, 0, -10).valid).toBe(false);
  });

  it("validates exact full payment movement", () => {
    const res = validatePaymentMovement(100, 0, 100);
    expect(res.valid).toBe(true);
    expect(res.saldoRestante).toBe(0);
  });

  it("supports multiple partial payments up to total value", () => {
    const p1 = validatePaymentMovement(100, 0, 40);
    expect(p1.valid).toBe(true);
    expect(p1.saldoRestante).toBe(60);

    const p2 = validatePaymentMovement(100, 40, 60);
    expect(p2.valid).toBe(true);
    expect(p2.saldoRestante).toBe(0);
  });

  it("blocks overpayment with clear code and detail", () => {
    const res = validatePaymentMovement(100, 50, 60);
    expect(res.valid).toBe(false);
    expect(res.code).toBe("AMOUNT_EXCEEDS_REMAINING");
  });

  it("derives target status based on launch type and payment progress", () => {
    expect(deriveLancamentoStatus("despesa", 100, 0)).toBe("a_pagar");
    expect(deriveLancamentoStatus("despesa", 100, 50)).toBe("parcial");
    expect(deriveLancamentoStatus("despesa", 100, 100)).toBe("pago");

    expect(deriveLancamentoStatus("receita", 200, 0)).toBe("a_receber");
    expect(deriveLancamentoStatus("receita", 200, 100)).toBe("parcial");
    expect(deriveLancamentoStatus("receita", 200, 200)).toBe("recebido");
  });
});
