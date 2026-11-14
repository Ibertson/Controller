// Pedidos: numeração, totais, busca e o resumo do topo.
import type { Order, OrderItem, OrderStatus } from "./types";

export const ORDER_STATUSES: { id: OrderStatus; label: string; tone: string }[] = [
  { id: "novo", label: "Novo", tone: "bg-accent-soft text-accent" },
  { id: "preparo", label: "Em preparo", tone: "bg-warning-soft text-warning" },
  { id: "pronto", label: "Pronto", tone: "bg-surface text-text" },
  { id: "entregue", label: "Entregue", tone: "bg-success/10 text-success" },
  { id: "cancelado", label: "Cancelado", tone: "bg-danger-soft text-danger" },
];
export const orderStatus = (id: OrderStatus) => ORDER_STATUSES.find((s) => s.id === id) ?? ORDER_STATUSES[0];
export const isOpen = (o: Pick<Order, "status">) => o.status !== "entregue" && o.status !== "cancelado";

export const formatOrderNumber = (n: number) => `PED-${String(n).padStart(4, "0")}`;
export const nextOrderNumber = (list: Pick<Order, "number">[]) => list.reduce((m, o) => Math.max(m, o.number), 0) + 1;

export const itemTotal = (i: Pick<OrderItem, "qty" | "unitCents">) => Math.round(i.qty * i.unitCents);
export function orderTotals(items: Pick<OrderItem, "qty" | "unitCents">[], discountCents: number) {
  const subtotal = items.reduce((t, i) => t + itemTotal(i), 0);
  return { subtotal, discount: Math.min(discountCents, subtotal), total: Math.max(0, subtotal - discountCents) };
}
export const orderTotal = (o: Order) => orderTotals(o.items, o.discountCents).total;

/** Cards do topo: todos os pedidos, os em aberto e o valor dos que não foram cancelados. */
export function orderSummary(list: Order[]) {
  const live = list.filter((o) => o.status !== "cancelado");
  return { count: list.length, open: list.filter(isOpen).length, totalCents: live.reduce((t, o) => t + orderTotal(o), 0) };
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
/** Busca por número (PED-0007, 0007 ou 7) ou nome do cliente; mais novos primeiro. */
export function filterOrders(list: Order[], query: string, status: OrderStatus | "all" | "open"): Order[] {
  const q = norm(query.trim());
  const digits = q.replace(/^ped-?/, "").replace(/^0+/, "");
  return list.filter((o) => (status === "all" ? true : status === "open" ? isOpen(o) : o.status === status))
    .filter((o) => !q || norm(o.clientName).includes(q) || norm(formatOrderNumber(o.number)).includes(q) || (/^\d+$/.test(digits) && String(o.number) === digits))
    .sort((a, b) => b.number - a.number);
}

/** Entrega já passou e o pedido segue aberto. */
export const isLate = (o: Order, todayStr: string) => isOpen(o) && !!o.deliveryOn && o.deliveryOn < todayStr;
