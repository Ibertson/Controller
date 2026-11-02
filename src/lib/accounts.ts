import { accountBalances } from "./summary";
import type { Account, Snapshot, Transaction } from "./types";

export const ACCOUNT_KINDS: Record<Account["kind"], string> = {
  checking: "Conta Corrente", savings: "Poupança", wallet: "Dinheiro", other: "Outra",
};

/** Bancos, carteiras, corretoras e benefícios da lista "Selecionar Banco" (só nomes; dá para digitar outro). */
export const BANKS = [
  "Nubank", "Banco Inter", "Banco Inter PJ", "C6 Bank", "Neon", "PicPay",
  "PagBank (PagSeguro)", "Mercado Pago", "Will Bank", "Next", "Next Joy", "Digio",
  "Banco Original", "Banco N26", "Nomad", "99Pay", "Conta 99", "Ame Digital",
  "Cora", "Cora PJ", "Trigg", "Superdigital", "RecargaPay", "Uber Conta",
  "Banco do Brasil", "Banco Caixa Econômica Federal", "Itaú", "Itaú Empresas", "Itaú Iti", "Itaú Personnalité",
  "Bradesco", "Santander", "HSBC", "Banco BRB (Banco de Brasília)", "Banrisul", "Banese",
  "Banestes", "Banpará", "Banco do Nordeste", "Mercantil do Brasil", "Banco BMG", "BMG Digital",
  "Meu BMG", "Banco Pan", "Banco Panamericano", "Banco Safra", "Banco Modal", "Banco Daycoval",
  "Banco Sofisa", "Banco Bari", "BS2", "Banco ABC Brasil", "Banco Alfa", "Banco BBM",
  "Banco Ourinvest", "Banco RCI", "BV (Banco Votorantim)", "BRDE", "Paraná Banco", "Alterbank",
  "AgZero", "Agibank", "Efí (antiga Gerencianet)", "Stone", "SumUp", "InfinitePay",
  "Asaas", "Pagar.me", "Omie Cash", "Sicoob", "Sicredi", "Ailos",
  "Cresol", "Unicred", "Cooperforte", "BTG Pactual", "XP Investimentos", "Rico",
  "Clear", "Ágora Investimentos", "Genial Investimentos", "Toro Investimentos", "Warren", "Nu Invest",
  "Avenue", "Tesouro Direto", "Mercado Bitcoin", "NovaDAX", "PayPal", "PayU",
  "Payoneer", "Wise", "Revolut", "Moip", "Alelo", "Ticket",
  "Pluxee (Sodexo)", "VR Benefícios", "Caju", "Flash", "Swile", "iFood Pago",
  "Appmax", "Cakto", "AstroPay", "Midway S.A.", "Hurst Capital", "Octa",
  "Peer BR", "Webull", "Banco Nova Futura", "CM Capital",
];

const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
/** Busca sem acento e sem maiúsculas. */
export function searchBanks(q: string, list = BANKS): string[] {
  const t = fold(q.trim());
  return t ? list.filter((b) => fold(b).includes(t)) : list;
}

/** Cor fixa por nome para o círculo de iniciais (paleta própria, sem cores de marca). */
const AVATAR_COLORS = ["#2f6fd6", "#0b7a5e", "#7a3fc2", "#c2611b", "#a3304a", "#1f6f80", "#4b4fc9", "#a07a12", "#c2453a", "#16a34a"];
export function avatarColor(name: string): string {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

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
