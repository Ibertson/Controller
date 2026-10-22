// Extrato: filtros da tela (Geral/Cartão, período por datas, busca, categoria, tipo, pessoa, conta, valores).
import { normName } from "./categories";
import type { Snapshot, Transaction } from "./types";

export type ExtratoTab = "geral" | "cartao";
export type ExtratoKind = "all" | "income" | "expense" | "transfer";

export interface ExtratoFilters {
  tab: ExtratoTab;
  /** AAAA-MM-DD; vazio = sem limite. */
  from: string;
  to: string;
  search: string;
  categoryId: string;
  kind: ExtratoKind;
  /** null = todas; "" = titular (lançamentos sem pessoa). */
  personId: string | null;
  /** Conta na aba Geral, cartão na aba Cartão; vazio = todos. */
  sourceId: string;
  minCents: number | null;
  maxCents: number | null;
}

export const emptyFilters = (from: string, to: string): ExtratoFilters => ({
  tab: "geral", from, to, search: "", categoryId: "", kind: "all", personId: null, sourceId: "", minCents: null, maxCents: null,
});

/** Transferências incluem o pagamento de fatura: o dinheiro só muda de lugar. */
const kindOf = (t: Transaction): Exclude<ExtratoKind, "all"> =>
  t.kind === "income" ? "income" : t.kind === "expense" ? "expense" : "transfer";

export function filterStatement(s: Snapshot, f: ExtratoFilters): Transaction[] {
  const q = normName(f.search);
  // Filtrar por uma categoria inclui as subcategorias dela.
  const cats = f.categoryId ? new Set([f.categoryId, ...s.categories.filter((c) => c.parentId === f.categoryId).map((c) => c.id)]) : null;
  return s.transactions.filter((t) => {
    if (f.tab === "cartao" && !t.cardId) return false;
    if (f.from && t.occurredOn < f.from) return false;
    if (f.to && t.occurredOn > f.to) return false;
    if (q && !normName(t.description).includes(q)) return false;
    if (cats && !cats.has(t.categoryId ?? "")) return false;
    if (f.kind !== "all" && kindOf(t) !== f.kind) return false;
    if (f.personId != null && (t.personId ?? "") !== f.personId) return false;
    if (f.sourceId) {
      const hit = f.tab === "cartao" ? t.cardId === f.sourceId : t.accountId === f.sourceId || t.toAccountId === f.sourceId;
      if (!hit) return false;
    }
    if (f.minCents != null && t.amountCents < f.minCents) return false;
    if (f.maxCents != null && f.maxCents > 0 && t.amountCents > f.maxCents) return false;
    return true;
  }).sort((a, b) => a.occurredOn.localeCompare(b.occurredOn) || a.createdAt.localeCompare(b.createdAt));
}

export function statementTotals(items: Transaction[]) {
  let income = 0, expense = 0;
  for (const t of items) {
    if (t.kind === "income") income += t.amountCents;
    else if (t.kind === "expense") expense += t.amountCents;
  }
  return { income, expense, net: income - expense };
}

/** Quantos filtros (fora o período e a aba) estão ligados. */
export function activeFilterCount(f: ExtratoFilters): number {
  return [f.search.trim(), f.categoryId, f.kind !== "all", f.personId != null, f.sourceId, f.minCents, f.maxCents].filter(Boolean).length;
}
