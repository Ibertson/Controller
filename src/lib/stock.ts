// Controle de estoque: entradas e saídas, custo médio, validade e os números do topo.
import { lowStock } from "./products";
import type { Product, StockMovement } from "./types";

export interface MoveInput {
  productId: string; kind: "in" | "out"; qty: number;
  /** Custo unitário da compra (só entrada; null = mantém o custo atual). */
  unitCostCents: number | null;
  note: string;
  /** Validade do lote (só entrada). */
  expiresOn: string | null;
  occurredOn: string;
}

/**
 * Aplica uma movimentação no produto: entrada soma e recalcula o custo médio; saída subtrai
 * (não deixa ficar negativo). A validade guardada é a mais próxima entre os lotes em estoque;
 * quando o estoque zera, ela some.
 */
export function applyMovement(p: Product, m: Pick<MoveInput, "kind" | "qty" | "unitCostCents" | "expiresOn">): Product {
  if (!(m.qty > 0)) throw new Error("Informe uma quantidade maior que zero.");
  if (m.kind === "out") {
    if (m.qty > p.stock + 1e-9) throw new Error(`A saída é maior que o estoque atual (${p.stock.toLocaleString("pt-BR")}).`);
    const stock = round3(p.stock - m.qty);
    return { ...p, stock, expiresOn: stock > 0 ? p.expiresOn ?? null : null };
  }
  const before = Math.max(0, p.stock);
  const stock = round3(before + m.qty);
  const costCents = m.unitCostCents != null && m.unitCostCents >= 0
    ? Math.round((before * p.costCents + m.qty * m.unitCostCents) / stock)
    : p.costCents;
  const current = before > 0 ? p.expiresOn ?? null : null;
  const expiresOn = m.expiresOn && current ? (m.expiresOn < current ? m.expiresOn : current) : m.expiresOn ?? current;
  return { ...p, stock, costCents, expiresOn };
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Vence em até 30 dias (ou já venceu) e ainda tem estoque. */
export const expiringSoon = (p: Pick<Product, "stock" | "expiresOn">, todayStr: string) =>
  p.stock > 0 && !!p.expiresOn && p.expiresOn <= addDays(todayStr, 30);

/** Cartões do topo: estoque baixo, próximos da validade e valor do estoque a preço de custo. */
export function stockSummary(list: Product[], todayStr: string) {
  return {
    low: list.filter((p) => p.active && lowStock(p)).length,
    expiring: list.filter((p) => p.active && expiringSoon(p, todayStr)).length,
    valueCents: list.reduce((t, p) => t + Math.round(Math.max(0, p.stock) * p.costCents), 0),
  };
}

/** Entradas e saídas do mês (quantidade e valor a custo). */
export function monthTotals(list: StockMovement[]) {
  return list.reduce((t, m) => {
    const v = Math.round(m.qty * (m.unitCostCents ?? 0));
    return m.kind === "in" ? { ...t, inQty: t.inQty + m.qty, inCents: t.inCents + v } : { ...t, outQty: t.outQty + m.qty, outCents: t.outCents + v };
  }, { inQty: 0, inCents: 0, outQty: 0, outCents: 0 });
}
