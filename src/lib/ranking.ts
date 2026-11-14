import { itemTotal, orderTotals } from "./orders";
import type { Order, Product } from "./types";

export type RangeKey = "7" | "30" | "90" | "ano";
export const RANGES: { key: RangeKey; label: string; title: string }[] = [
  { key: "7", label: "7 dias", title: "Últimos 7 dias" },
  { key: "30", label: "30 dias", title: "Últimos 30 dias" },
  { key: "90", label: "90 dias", title: "Últimos 90 dias" },
  { key: "ano", label: "Este ano", title: "Este ano" },
];

const shift = (day: string, days: number) => {
  const d = new Date(day + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** Datas (inclusive) do período: N dias para trás até hoje, ou 1º de janeiro até hoje. */
export function rangeDates(key: RangeKey, todayStr: string): { from: string; to: string } {
  if (key === "ano") return { from: todayStr.slice(0, 4) + "-01-01", to: todayStr };
  return { from: shift(todayStr, -Number(key)), to: todayStr };
}

/** Primeiro e último dia de um mês "YYYY-MM". */
export function monthDates(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

export interface ProductRank {
  key: string; productId: string | null; name: string;
  qty: number; revenueCents: number; costCents: number; profitCents: number;
  /** Margem sobre o faturamento (%), uma casa; null sem faturamento. */
  margin: number | null;
  /** Fatia do faturamento total do período (%), uma casa. */
  share: number;
  /** Sem custo conhecido (produto apagado ou sem custo cadastrado). */
  noCost: boolean;
}

export interface Ranking { items: ProductRank[]; revenueCents: number; profitCents: number; units: number; orders: number; ticketCents: number; }

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Vendas de produtos nos pedidos do período (cancelados não contam).
 * O desconto do pedido é repartido entre os itens na proporção do valor; o custo é o custo atual do produto.
 */
export function productRanking(orders: Order[], products: Product[], from: string, to: string): Ranking {
  const byId = new Map(products.map((p) => [p.id, p]));
  const acc = new Map<string, Omit<ProductRank, "profitCents" | "margin" | "share">>();
  let orderCount = 0;
  for (const o of orders) {
    if (o.status === "cancelado" || o.orderedOn < from || o.orderedOn > to) continue;
    const productItems = o.items.filter((i) => i.productId && i.qty > 0);
    if (!productItems.length) continue;
    orderCount++;
    const { subtotal, discount } = orderTotals(o.items, o.discountCents);
    for (const it of productItems) {
      const gross = itemTotal(it);
      const net = subtotal > 0 ? gross - Math.round((discount * gross) / subtotal) : gross;
      const p = byId.get(it.productId!);
      const key = it.productId!;
      const cur = acc.get(key) ?? { key, productId: it.productId, name: p?.name ?? it.name, qty: 0, revenueCents: 0, costCents: 0, noCost: !p || !p.costCents };
      cur.qty += it.qty;
      cur.revenueCents += net;
      cur.costCents += Math.round((p?.costCents ?? 0) * it.qty);
      acc.set(key, cur);
    }
  }
  const revenueCents = [...acc.values()].reduce((t, r) => t + r.revenueCents, 0);
  const items = [...acc.values()].map((r): ProductRank => {
    const profitCents = r.revenueCents - r.costCents;
    return { ...r, profitCents, margin: r.revenueCents > 0 ? round1((profitCents / r.revenueCents) * 100) : null, share: revenueCents > 0 ? round1((r.revenueCents / revenueCents) * 100) : 0 };
  });
  const units = items.reduce((t, r) => t + r.qty, 0);
  const profitCents = items.reduce((t, r) => t + r.profitCents, 0);
  return { items, revenueCents, profitCents, units, orders: orderCount, ticketCents: orderCount ? Math.round(revenueCents / orderCount) : 0 };
}

export type RankBy = "qty" | "revenueCents" | "profitCents";

/** Ordena pelo critério; empate desempata por faturamento e nome. */
export function rankBy(items: ProductRank[], by: RankBy): ProductRank[] {
  return [...items].sort((a, b) => b[by] - a[by] || b.revenueCents - a.revenueCents || a.name.localeCompare(b.name, "pt-BR"));
}
