// Cadastro de serviços da empresa: categorias, duração e sugestões de preço.
import { categoryOptions } from "./products";
import type { Service } from "./types";

/** Categorias da lista "Selecione a categoria" do serviço. */
export const SERVICE_CATEGORIES: { name: string; emoji: string }[] = [
  { name: "Vendas", emoji: "🛍️" }, { name: "Serviços", emoji: "🧰" }, { name: "Comissões", emoji: "🧾" }, { name: "Outros", emoji: "🪙" },
];

export const serviceCategoryOptions = (custom: string[], current = "") => categoryOptions(custom, current, SERVICE_CATEGORIES);

/** Duração digitada: "2,5", "2.5" ou "2" → horas; null se inválida. Vazio = null. */
export function parseHours(v: string): number | null {
  const t = v.trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return n > 0 && n <= 1000 ? Math.round(n * 100) / 100 : null;
}

/** 2.5 → "2h30", 1 → "1h", 0.25 → "15min". */
export function formatHours(h: number): string {
  const total = Math.round(h * 60);
  const hh = Math.floor(total / 60), mm = total % 60;
  if (!hh) return `${mm}min`;
  return mm ? `${hh}h${String(mm).padStart(2, "0")}` : `${hh}h`;
}

/** Valor por hora do serviço (centavos), null sem duração. */
export const hourlyCents = (s: Pick<Service, "priceCents" | "hours">) => (s.hours > 0 ? Math.round(s.priceCents / s.hours) : null);

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

/** Arredonda para um valor "de tabela": de R$ 1 em R$ 1 até R$ 100, depois de R$ 5 em R$ 5, e de R$ 10 em R$ 10 acima de R$ 1.000. */
export function roundPrice(c: number): number {
  const step = c >= 100000 ? 1000 : c >= 10000 ? 500 : 100;
  return Math.max(step, Math.round(c / step) * step);
}

export type PriceBasis = "similar" | "mine" | "typed";
export interface PriceSuggestion { economic: number; recommended: number; premium: number; basis: PriceBasis }

/**
 * Sugestões de preço: valor por hora mediano dos seus serviços da mesma categoria (ou de todos) vezes a
 * duração; sem histórico, parte do valor base digitado. Econômico −30%, Premium +40%.
 */
export function suggestPrices(list: Service[], input: { id?: string; category: string; hours: number | null; priceCents: number | null }): PriceSuggestion | null {
  const others = list.filter((s) => s.id !== input.id && s.active && s.hours > 0 && s.priceCents > 0);
  const same = others.filter((s) => s.category === input.category);
  let rec: number | null = null;
  let basis: PriceBasis = "typed";
  if (input.hours) {
    const pool = input.category && same.length ? same : others;
    if (pool.length) {
      rec = median(pool.map((s) => s.priceCents / s.hours)) * input.hours;
      basis = pool === same ? "similar" : "mine";
    }
  }
  if (rec == null && input.priceCents && input.priceCents > 0) rec = input.priceCents;
  if (rec == null) return null;
  return { economic: roundPrice(rec * 0.7), recommended: roundPrice(rec), premium: roundPrice(rec * 1.4), basis };
}

/** Números do topo da lista. */
export function serviceTotals(list: Service[]) {
  const active = list.filter((s) => s.active);
  const rates = active.map(hourlyCents).filter((x): x is number => x != null);
  return {
    count: list.length,
    active: active.length,
    avgPriceCents: active.length ? Math.round(active.reduce((t, s) => t + s.priceCents, 0) / active.length) : 0,
    avgHourlyCents: rates.length ? Math.round(rates.reduce((t, x) => t + x, 0) / rates.length) : 0,
  };
}

const fold = (v: string) => v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
/** Busca por nome, categoria ou descrição, sem ligar para acento. */
export function searchServices(list: Service[], q: string): Service[] {
  const t = fold(q.trim());
  if (!t) return list;
  return list.filter((s) => [s.name, s.category, s.description].some((x) => fold(x).includes(t)));
}
