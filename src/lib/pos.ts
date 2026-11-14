import type { CashRegister, PosItem, PosPayment, PosSale, Product } from "./types";

export const POS_PAYMENTS: { id: PosPayment; label: string }[] = [
  { id: "pix", label: "PIX" }, { id: "dinheiro", label: "Dinheiro" }, { id: "debito", label: "Débito" }, { id: "credito", label: "Crédito" },
];
export const posPaymentLabel = (id: PosPayment) => POS_PAYMENTS.find((p) => p.id === id)?.label ?? id;

export const formatSaleNumber = (n: number) => `VEN-${String(n).padStart(4, "0")}`;
export const nextSaleNumber = (list: Pick<PosSale, "number">[]) => list.reduce((m, s) => Math.max(m, s.number), 0) + 1;

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Produtos ativos que batem com a busca (nome, categoria ou código), em ordem alfabética. */
export function searchProducts(list: Product[], query: string): Product[] {
  const q = norm(query);
  return list.filter((p) => p.active && (!q || norm(p.name).includes(q) || norm(p.category).includes(q) || (p.sku && norm(p.sku).includes(q))))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

/** Leitor de código de barras: código exato de um produto ativo. */
export const productByCode = (list: Product[], code: string) => {
  const c = norm(code);
  return c ? list.find((p) => p.active && p.sku && norm(p.sku) === c) : undefined;
};

export interface CartLine extends PosItem { stock: number; }

/** Soma 1 (ou `qty`) ao item, sem passar do estoque. Devolve o carrinho novo ou um erro. */
export function addToCart(cart: CartLine[], p: Product, qty = 1): { cart: CartLine[]; error?: string } {
  const line = cart.find((l) => l.productId === p.id);
  const want = (line?.qty ?? 0) + qty;
  if (p.stock <= 0) return { cart, error: `${p.name} está sem estoque.` };
  if (want > p.stock + 1e-9) return { cart, error: `Só há ${p.stock.toLocaleString("pt-BR")} ${p.unit || "un."} de ${p.name} em estoque.` };
  if (line) return { cart: cart.map((l) => (l.productId === p.id ? { ...l, qty: want, stock: p.stock } : l)) };
  return { cart: [...cart, { productId: p.id, name: p.name, qty, unitCents: p.priceCents, stock: p.stock }] };
}

/** Muda a quantidade (0 tira do carrinho; limita ao estoque). */
export function setQty(cart: CartLine[], productId: string, qty: number): CartLine[] {
  if (qty <= 0) return cart.filter((l) => l.productId !== productId);
  return cart.map((l) => (l.productId === productId ? { ...l, qty: Math.min(qty, l.stock) } : l));
}

export function cartTotals(cart: Pick<PosItem, "qty" | "unitCents">[], discountCents: number) {
  const subtotal = cart.reduce((t, l) => t + Math.round(l.qty * l.unitCents), 0);
  const discount = Math.min(Math.max(0, discountCents), subtotal);
  const units = cart.reduce((t, l) => t + l.qty, 0);
  return { subtotal, discount, total: subtotal - discount, units };
}

/** Troco do pagamento em dinheiro; null quando falta dinheiro. */
export function changeDue(totalCents: number, receivedCents: number | null): number | null {
  if (receivedCents == null) return 0;
  return receivedCents >= totalCents ? receivedCents - totalCents : null;
}

/** "Venda VEN-0003: Capuccino x2, Pão de queijo x1" (cortado em 140 caracteres). */
export function saleDescription(number: number, items: PosItem[]): string {
  const list = items.map((i) => `${i.name} x${i.qty.toLocaleString("pt-BR")}`).join(", ");
  const s = `Venda ${formatSaleNumber(number)}: ${list}`;
  return s.length > 140 ? s.slice(0, 139) + "…" : s;
}

/** Situação do caixa do dia para o selo do Ponto de Venda. */
export function registerState(list: CashRegister[], day: string): "aberto" | "fechado" | "nao_iniciado" {
  const r = list.find((x) => x.day === day);
  return !r ? "nao_iniciado" : r.status === "open" ? "aberto" : "fechado";
}

/** Vendas do dia, mais novas primeiro, e o total das concluídas. */
export function daySales(list: PosSale[], day: string) {
  const sales = list.filter((s) => s.soldOn === day).sort((a, b) => b.number - a.number);
  const done = sales.filter((s) => s.status === "concluida");
  return { sales, count: done.length, totalCents: done.reduce((t, s) => t + s.totalCents, 0) };
}
