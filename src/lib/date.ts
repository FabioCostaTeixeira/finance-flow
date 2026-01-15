import { format } from "date-fns";

/**
 * Formata uma Date para string YYYY-MM-DD usando o fuso LOCAL do navegador.
 *
 * Evita o bug clássico de "+/- 1 dia" quando se usa toISOString() (UTC).
 */
export function toISODateLocal(date: Date): string {
  return format(date, "yyyy-MM-dd");
}
