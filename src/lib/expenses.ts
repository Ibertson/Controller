// Despesas / Compras da empresa: junta o lançamento (valor, data, conta, pago) com tipo, fornecedor e funcionário.
import { addDays } from "./stock";
import type { Category, ExpenseDetail, ExpenseType, Transaction } from "./types";

export const EXPENSE_TYPES: { id: ExpenseType; label: string; plural: string }[] = [
  { id: "despesa", label: "Despesa", plural: "Despesas" },
  { id: "compra", label: "Compra", plural: "Compras" },
  { id: "folha", label: "Folha", plural: "Folha" },
];
export const expenseTypeLabel = (t: ExpenseType) => EXPENSE_TYPES.find((x) => x.id === t)?.label ?? t;

export type ExpenseStatus = "paid" | "pending" | "overdue";
export interface ExpenseRow {
  t: Transaction; type: ExpenseType; supplier: string; employee: string;
  installment: number | null; installments: number | null;
  /** Vencimento (pendente) ou data do pagamento (pago). */
  due: string; status: ExpenseStatus;
  paymentMethod: string; notes: string; receiptPath: string | null;
}

/** Despesas ativas do espaço com os dados extras (lançamentos feitos em outras telas entram como "Despesa"). */
export function expenseRows(transactions: Transaction[], details: ExpenseDetail[], todayStr: string): ExpenseRow[] {
  const byId = new Map(details.map((d) => [d.transactionId, d]));
  return transactions.filter((t) => t.kind === "expense" && !t.deletedAt).map((t): ExpenseRow => {
    const d = byId.get(t.id);
    const due = t.isPaid ? t.occurredOn : t.dueOn ?? t.occurredOn;
    return {
      t, type: d?.type ?? "despesa", supplier: d?.supplier ?? "", employee: d?.employee ?? "",
      installment: t.installmentNumber ?? d?.installment ?? null, installments: t.installmentTotal ?? d?.installments ?? null,
      due, status: t.isPaid ? "paid" : due < todayStr ? "overdue" : "pending",
      paymentMethod: d?.paymentMethod ?? "", notes: d?.notes ?? "", receiptPath: d?.receiptPath ?? null,
    };
  }).sort((a, b) => b.t.occurredOn.localeCompare(a.t.occurredOn) || b.t.createdAt.localeCompare(a.t.createdAt));
}

/** Cartões do topo: despesas, compras e folha do período; pendente e vencidas de todos os meses. */
export function expenseSummary(periodRows: ExpenseRow[], allRows: ExpenseRow[]) {
  const sum = (type: ExpenseType) => periodRows.filter((r) => r.type === type).reduce((t, r) => t + r.t.amountCents, 0);
  const open = allRows.filter((r) => r.status !== "paid");
  return {
    despesaCents: sum("despesa"), compraCents: sum("compra"), folhaCents: sum("folha"),
    folhaCount: periodRows.filter((r) => r.type === "folha").length,
    pendingCents: open.reduce((t, r) => t + r.t.amountCents, 0), pendingCount: open.length,
    overdueCount: open.filter((r) => r.status === "overdue").length,
  };
}

export type QuickFilter = "all" | "pending" | "overdue" | "due7" | "due30";
export interface ExpenseFilter {
  type: ExpenseType | "all"; quick: QuickFilter;
  /** Mês "2026-11" (vale quando não há período). */
  month: string; from: string; to: string;
  categoryId: string; employee: string; supplier: string; status: "all" | "paid" | "pending";
}
export const emptyAdvanced = { from: "", to: "", categoryId: "", employee: "", supplier: "", status: "all" as const };

export function filterExpenses(rows: ExpenseRow[], f: ExpenseFilter, todayStr: string): ExpenseRow[] {
  const in7 = addDays(todayStr, 7), in30 = addDays(todayStr, 30);
  return rows.filter((r) => {
    if (f.type !== "all" && r.type !== f.type) return false;
    if (f.quick === "pending" && r.status === "paid") return false;
    if (f.quick === "overdue" && r.status !== "overdue") return false;
    if ((f.quick === "due7" || f.quick === "due30") && (r.status === "paid" || r.due < todayStr || r.due > (f.quick === "due7" ? in7 : in30))) return false;
    // Os atalhos de vencimento olham todos os meses; o resto respeita o período ou o mês.
    if (f.quick === "all" || f.quick === "pending") {
      const d = r.t.occurredOn;
      if (f.from || f.to) { if ((f.from && d < f.from) || (f.to && d > f.to)) return false; }
      else if (!d.startsWith(f.month)) return false;
    }
    if (f.categoryId && r.t.categoryId !== f.categoryId) return false;
    if (f.employee && r.employee !== f.employee) return false;
    if (f.supplier && r.supplier !== f.supplier) return false;
    if (f.status === "paid" && r.status !== "paid") return false;
    if (f.status === "pending" && r.status === "paid") return false;
    return true;
  });
}

/** Total por categoria (subcategoria soma na categoria-mãe), maior primeiro. */
export function byCategory(rows: ExpenseRow[], categories: Category[]): { id: string; name: string; cents: number }[] {
  const cat = new Map(categories.map((c) => [c.id, c]));
  const out = new Map<string, { id: string; name: string; cents: number }>();
  for (const r of rows) {
    let c = r.t.categoryId ? cat.get(r.t.categoryId) : undefined;
    if (c?.parentId) c = cat.get(c.parentId) ?? c;
    const id = c?.id ?? "", name = c?.name ?? "Sem categoria";
    const cur = out.get(id) ?? { id, name, cents: 0 };
    cur.cents += r.t.amountCents;
    out.set(id, cur);
  }
  return [...out.values()].sort((a, b) => b.cents - a.cents);
}

/** Valores distintos (fornecedores, funcionários) em ordem alfabética. */
export const distinct = (values: string[]) => [...new Set(values.map((v) => v.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));

/** Categorias sugeridas no Registrar Despesa (criadas na primeira vez que forem usadas). */
export const BUSINESS_CATEGORIES: { name: string; emoji: string; icon: string }[] = [
  { name: "Mercadorias", emoji: "🛒", icon: "shopping-cart" },
  { name: "Embalagens", emoji: "📦", icon: "shopping-bag" },
  { name: "Aluguel", emoji: "🏠", icon: "house" },
  { name: "Energia", emoji: "💡", icon: "lightbulb" },
  { name: "Água", emoji: "💧", icon: "droplet" },
  { name: "Internet", emoji: "🌐", icon: "wifi" },
  { name: "Funcionários", emoji: "👥", icon: "users" },
  { name: "Impostos", emoji: "🧾", icon: "percent" },
  { name: "Marketing", emoji: "📣", icon: "share-2" },
  { name: "Manutenção", emoji: "🔧", icon: "wrench" },
  { name: "Software", emoji: "💻", icon: "tv" },
  { name: "Transporte", emoji: "🚚", icon: "truck" },
];
export const PAYROLL_CATEGORY = "Funcionários";

export const PAYMENT_METHODS = [
  { id: "pix", label: "PIX" }, { id: "dinheiro", label: "Dinheiro" }, { id: "debito", label: "Cartão de débito" },
  { id: "credito", label: "Cartão de crédito" }, { id: "boleto", label: "Boleto" }, { id: "transferencia", label: "Transferência" },
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]["id"];
export const paymentMethodLabel = (id: string) => PAYMENT_METHODS.find((m) => m.id === id)?.label ?? "";

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
/** Categoria de despesa já existente com esse nome (sem diferenciar acento e maiúscula). */
export function findCategoryByName(categories: Category[], name: string): Category | undefined {
  return categories.find((c) => !c.archived && c.kind !== "income" && norm(c.name) === norm(name));
}

/** Divide o total em n parcelas; os centavos que sobram vão na primeira. */
export function splitCents(total: number, n: number): number[] {
  const base = Math.floor(total / n);
  return Array.from({ length: n }, (_, i) => base + (i === 0 ? total - base * n : 0));
}

/** Texto do lançamento: categoria e fornecedor ("Aluguel · Imobiliária Sol"). */
export function expenseDescription(category: string, supplier: string): string {
  return [category.trim(), supplier.trim()].filter(Boolean).join(" · ") || "Despesa";
}

export const RECEIPT_TYPES = ["application/pdf", "image/jpeg", "image/png"];
export const RECEIPT_MAX_BYTES = 5 * 1024 * 1024;
/** Erro do comprovante, ou null se ele pode ser enviado. */
export function receiptError(file: { type: string; size: number }): string | null {
  if (!RECEIPT_TYPES.includes(file.type)) return "Envie um PDF, JPG ou PNG.";
  if (file.size > RECEIPT_MAX_BYTES) return "O arquivo passa de 5MB.";
  return null;
}
