import { accountBalances } from "./summary";
import type { Account, Snapshot, Transaction } from "./types";

export const ACCOUNT_KINDS: Record<Account["kind"], string> = {
  checking: "Conta Corrente", savings: "Poupança", wallet: "Dinheiro", other: "Outra",
};

/** Bancos para sugerir no campo (só nomes; o usuário pode digitar outro). */
export const BANKS = [
  "Banco do Brasil", "Caixa Econômica Federal", "Itaú", "Bradesco", "Santander", "Nubank", "Inter", "C6 Bank",
  "BTG Pactual", "Sicoob", "Sicredi", "Banrisul", "PicPay", "Mercado Pago", "PagBank", "Neon", "Original", "Safra",
];

export const DEBIT_BRANDS = ["Visa", "Mastercard", "Elo"];

/** Cores das subcontas (paleta própria). */
export const SUB_COLORS = ["#2f6fd6", "#16a34a", "#d99a0b", "#dc2626", "#7a3fc2", "#db2777", "#0891b2", "#ea580c"];

/** Nome mostrado: etiqueta ou banco; contas antigas usam o nome salvo. */
export function accountTitle(a: Pick<Account, "name" | "bank" | "label">): string {
  return a.bank?.trim() || a.name;
}

/** Nome guardado (usado nas listas de lançamento): banco + etiqueta. */
export function accountName(bank: string, label: string): string {
  const b = bank.trim(), l = label.trim();
  return b && l ? `${b} · ${l}` : b || l || "Conta";
}

/** Iniciais do banco para o círculo (até 2 letras). */
export function bankInitials(name: string): string {
  const words = name.replace(/[^\p{L}\p{N} ]/gu, " ").split(/\s+/).filter((w) => w && !/^(de|do|da|dos|das|e)$/i.test(w));
  if (!words.length) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export const subaccounts = (s: Snapshot, id: string) => s.accounts.filter((a) => a.parentId === id && !a.archived);

/** Lançamentos que mexem nesta conta (cartão de crédito fica de fora: entra só no pagamento da fatura). */
export function accountTransactions(s: Snapshot, id: string): Transaction[] {
  return s.transactions.filter((t) => (t.accountId === id && !t.cardId) || t.toAccountId === id);
}

export function inMonth(t: Transaction, month: string) { return t.occurredOn.slice(0, 7) === month.slice(0, 7); }

export interface AccountStats {
  balanceCents: number;
  overdraftCents: number | null;
  subTotalCents: number;
  /** Saldo + subcontas + cheque especial. */
  availableCents: number;
  incomeCents: number;
  expenseCents: number;
}

/** Números do topo da conta para o mês escolhido (receitas e despesas pagas ou não). */
export function accountStats(s: Snapshot, a: Account, month: string): AccountStats {
  const bal = accountBalances(s);
  const balanceCents = bal.get(a.id) ?? 0;
  const subTotalCents = subaccounts(s, a.id).reduce((sum, x) => sum + (bal.get(x.id) ?? 0), 0);
  let incomeCents = 0, expenseCents = 0;
  for (const t of accountTransactions(s, a.id)) {
    if (!inMonth(t, month)) continue;
    if (t.kind === "income") incomeCents += t.amountCents;
    if (t.kind === "expense" || t.kind === "card_payment") expenseCents += t.amountCents;
  }
  const overdraftCents = a.overdraftCents ?? null;
  return { balanceCents, overdraftCents, subTotalCents, availableCents: balanceCents + subTotalCents + (overdraftCents ?? 0), incomeCents, expenseCents };
}

/** Conta do saldo: inicial + entradas − saídas (só o que já foi pago). */
export function balanceBreakdown(s: Snapshot, a: Account) {
  let inCents = 0, outCents = 0;
  for (const t of accountTransactions(s, a.id)) {
    if (!t.isPaid) continue;
    const incoming = t.kind === "income" || (t.kind === "transfer" && t.toAccountId === a.id);
    if (incoming) inCents += t.amountCents; else outCents += t.amountCents;
  }
  return { initialCents: a.initialBalanceCents, inCents, outCents, totalCents: a.initialBalanceCents + inCents - outCents };
}

/** Saldo inicial que faz o saldo de hoje virar `currentCents` (sem mexer nos lançamentos). */
export function initialForCurrent(s: Snapshot, a: Account, currentCents: number): number {
  const now = accountBalances(s).get(a.id) ?? a.initialBalanceCents;
  return a.initialBalanceCents + (currentCents - now);
}

/** Endereço da página da conta (query, para abrir também sem internet). */
export const accountHref = (id: string) => `/contas/conta?id=${encodeURIComponent(id)}`;
