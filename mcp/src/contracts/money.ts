export function parseCanonicalDecimal(value: unknown): string {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || Number.isNaN(value)) {
      throw new Error("INVALID_MONETARY_VALUE: Number must be finite and not NaN");
    }
    value = value.toString();
  }

  if (typeof value !== "string") {
    throw new Error("INVALID_MONETARY_VALUE: Value must be a string or number");
  }

  const trimmed = value.trim();
  if (!/^-?\d+(\.\d{1,2})?$/.test(trimmed)) {
    throw new Error("INVALID_MONETARY_VALUE: Must be a canonical decimal string (e.g. '41.24') without commas or scientific notation");
  }

  const num = parseFloat(trimmed);
  if (num <= 0) {
    throw new Error("INVALID_MONETARY_VALUE: Monetary value must be greater than zero");
  }
  if (num > 999999999999.99) {
    throw new Error("INVALID_MONETARY_VALUE: Value exceeds maximum limit (999,999,999,999.99)");
  }

  return num.toFixed(2);
}

export function formatBRL(decimalString: string): string {
  const val = parseFloat(decimalString);
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
}
