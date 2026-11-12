// Cadastro de produtos da empresa: margem, totais do catálogo e categorias.
import type { Product } from "./types";

/** Categorias sugeridas no botão "Usar padrão". */
export const DEFAULT_PRODUCT_CATEGORIES = ["Alimentos", "Bebidas", "Roupas e acessórios", "Beleza e cuidados", "Casa e decoração", "Eletrônicos", "Papelaria", "Outros"];

export const UNITS = [
  { value: "un", label: "Unidade (un)" }, { value: "kg", label: "Quilo (kg)" }, { value: "g", label: "Grama (g)" },
  { value: "l", label: "Litro (l)" }, { value: "ml", label: "Mililitro (ml)" }, { value: "m", label: "Metro (m)" },
  { value: "cx", label: "Caixa (cx)" }, { value: "pct", label: "Pacote (pct)" }, { value: "par", label: "Par" },
];

/** Margem sobre o preço de venda (%), null sem preço. */
export function marginPct(p: Pick<Product, "costCents" | "priceCents">): number | null {
  if (p.priceCents <= 0) return null;
  return ((p.priceCents - p.costCents) / p.priceCents) * 100;
}

export const lowStock = (p: Pick<Product, "stock" | "minStock">) => p.minStock > 0 && p.stock <= p.minStock;

/** Números do topo: quantos produtos, quantas unidades e quanto vale o estoque a preço de venda e de custo. */
export function catalogTotals(list: Product[]) {
  return list.reduce((t, p) => ({
    count: t.count + 1,
    units: t.units + Math.max(0, p.stock),
    valueCents: t.valueCents + Math.round(Math.max(0, p.stock) * p.priceCents),
    costCents: t.costCents + Math.round(Math.max(0, p.stock) * p.costCents),
    low: t.low + (lowStock(p) ? 1 : 0),
  }), { count: 0, units: 0, valueCents: 0, costCents: 0, low: 0 });
}

const fold = (v: string) => v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
/** Busca por nome, código, categoria ou descrição, sem ligar para acento. */
export function searchProducts(list: Product[], q: string): Product[] {
  const t = fold(q.trim());
  if (!t) return list;
  return list.filter((p) => [p.name, p.sku, p.category, p.description].some((x) => fold(x).includes(t)));
}

/** Estoque aceita decimal (kg, l): "1,5" → 1.5. */
export function parseQty(v: string): number | null {
  const s = v.trim().replace(/\./g, "").replace(",", ".");
  if (!s) return 0;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 1000) / 1000 : null;
}
export const formatQty = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
