// Dinheiro sempre em centavos inteiros. Nada de float em valores.

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** 123456 -> "R$ 1.234,56" */
export function formatBRL(cents: number): string {
  return brl.format(cents / 100).replace(/ /g, " ");
}

/** Valor com sinal para listas: despesa "− R$ 10,00", receita "+ R$ 10,00". */
export function formatSigned(cents: number, kind: "income" | "expense" | "neutral"): string {
  if (kind === "income") return `+ ${formatBRL(Math.abs(cents))}`;
  if (kind === "expense") return `− ${formatBRL(Math.abs(cents))}`;
  return formatBRL(cents);
}

/**
 * Lê o que a pessoa digitou ("12", "12,5", "1.234,56", "R$ 9,90") e devolve centavos.
 * Retorna null se não for um valor válido.
 */
export function parseBRL(input: string): number | null {
  const s = input.replace(/[R$\s ]/g, "");
  if (!/^\d{1,3}(\.\d{3})*(,\d{0,2})?$|^\d+(,\d{0,2})?$/.test(s)) return null;
  const [int, frac = ""] = s.replace(/\./g, "").split(",");
  return Number(int) * 100 + Number(frac.padEnd(2, "0"));
}

/** Divide o total em n parcelas; os centavos que sobram vão para a 1ª. 10000 / 3 -> [3334, 3333, 3333] */
export function splitInstallments(totalCents: number, n: number): number[] {
  if (!Number.isInteger(n) || n < 1) throw new Error("número de parcelas inválido");
  const base = Math.floor(totalCents / n);
  const rest = totalCents - base * n;
  return Array.from({ length: n }, (_, i) => (i === 0 ? base + rest : base));
}
