import * as React from "react";

import { Input } from "@/components/ui/input";

function formatPtBrDecimal(value: number): string {
  // 2 casas, sem símbolo (ex: 0,10)
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function digitsToNumber(raw: string): number {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return 0;
  const cents = Number.parseInt(digits, 10);
  return Number.isFinite(cents) ? cents / 100 : 0;
}

export interface CurrencyInputProps
  extends Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "type"> {
  value: number;
  onValueChange: (nextValue: number) => void;
}

/**
 * Campo monetário BRL com comportamento de "centavos automáticos":
 * - Digitar 10 => mostra 0,10
 * - Digitar 1234 => mostra 12,34
 */
export function CurrencyInput({ value, onValueChange, ...props }: CurrencyInputProps) {
  const [display, setDisplay] = React.useState(() => formatPtBrDecimal(value));

  React.useEffect(() => {
    // Mantém sincronizado quando o form atualiza externamente (reset, edit, etc.)
    setDisplay(formatPtBrDecimal(value));
  }, [value]);

  return (
    <Input
      {...props}
      inputMode="numeric"
      autoComplete="off"
      value={display}
      onChange={(e) => {
        const next = digitsToNumber(e.target.value);
        onValueChange(next);
        setDisplay(formatPtBrDecimal(next));
      }}
      onBlur={(e) => {
        // Reaplica formatação limpa no blur
        const next = digitsToNumber(e.target.value);
        onValueChange(next);
        setDisplay(formatPtBrDecimal(next));
      }}
    />
  );
}
