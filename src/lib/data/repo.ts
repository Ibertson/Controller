import type { Account, Card, Category, Debt, Goal, GoalContribution, Investment, InvestmentGoal, NewTransactionInput, Person, Recurring, Snapshot, Transaction } from "../types";
import { emptySnapshot } from "./seed";

/**
 * Camada de dados. A Fase 1 começa com LocalRepo (navegador) e troca por SupabaseRepo
 * com as mesmas assinaturas, sem mexer nas telas.
 */
/** "signed_in": já entrou; "check_email": mandamos um link de acesso para o email. */
export type SignInResult = "signed_in" | "check_email";

export interface Repo {
  /** "local": dados só neste navegador, entra pelo nome. "supabase": entra pelo email. */
  readonly mode: "local" | "supabase";
  /** Usuário atual; null = precisa entrar; undefined = ainda carregando. */
  session(): { name: string } | null | undefined;
  /** Muda o nome do titular (quem está conectado). */
  renameSelf(name: string): Promise<void>;
  signIn(nameOrEmail: string): Promise<SignInResult>;
  signOut(): Promise<void>;
  /** Mensagem quando os dados não carregaram depois de entrar; null = tudo certo. */
  loadError(): string | null;
  /** Tenta carregar os dados de novo depois de um erro. */
  retry(): void;

  snapshot(): Snapshot | null;
  subscribe(listener: () => void): () => void;

  createTransaction(input: NewTransactionInput): Promise<Transaction[]>;
  /** Manda para a lixeira (esta parcela, as próximas ou todas). */
  deleteTransaction(id: string, scope: "one" | "future" | "all"): Promise<void>;
  /** Manda vários para a lixeira de uma vez. */
  trashTransactions(ids: string[]): Promise<void>;
  /** Tira da lixeira. */
  restoreTransactions(ids: string[]): Promise<void>;
  /** Apaga de vez (só da lixeira ou para desfazer um lançamento recém-criado). */
  purgeTransactions(ids: string[]): Promise<void>;
  markPaid(id: string, accountId?: string): Promise<void>;
  /** Apaga tudo do painel pessoal e recomeça com uma conta e as categorias padrão. Login e nome ficam. */
  resetAll(): Promise<void>;

  upsertAccount(a: Omit<Account, "workspaceId" | "id"> & { id?: string }): Promise<Account>;
  upsertCard(c: Omit<Card, "workspaceId" | "id"> & { id?: string }): Promise<Card>;
  upsertCategory(c: Omit<Category, "workspaceId" | "id"> & { id?: string }): Promise<Category>;
  upsertPerson(p: Omit<Person, "workspaceId" | "id"> & { id?: string }): Promise<Person>;
  upsertRecurring(r: Omit<Recurring, "workspaceId" | "id"> & { id?: string }): Promise<Recurring>;
  /** Apaga o gasto/receita fixa; lançamentos já feitos ficam. */
  deleteRecurring(id: string): Promise<void>;
  upsertGoal(g: Omit<Goal, "workspaceId" | "id" | "createdAt"> & { id?: string }): Promise<Goal>;
  /** Apaga a meta e os aportes dela. */
  deleteGoal(id: string): Promise<void>;
  addContribution(c: Omit<GoalContribution, "workspaceId" | "id">): Promise<GoalContribution>;
  upsertInvestment(i: Omit<Investment, "workspaceId" | "id"> & { id?: string }): Promise<Investment>;
  deleteInvestment(id: string): Promise<void>;
  upsertInvestmentGoal(g: Omit<InvestmentGoal, "workspaceId" | "id"> & { id?: string }): Promise<InvestmentGoal>;
  deleteInvestmentGoal(id: string): Promise<void>;
  upsertDebt(d: Omit<Debt, "workspaceId" | "id" | "createdAt"> & { id?: string }): Promise<Debt>;
  deleteDebt(id: string): Promise<void>;
}

/** Metas e aportes ao apagar uma meta. */
export function withoutGoal(d: Snapshot, id: string): Snapshot {
  return { ...d, goals: (d.goals ?? []).filter((g) => g.id !== id), goalContributions: (d.goalContributions ?? []).filter((c) => c.goalId !== id) };
}

/** Ids atingidos ao excluir um lançamento com o escopo pedido (parcelas). */
export function scopeIds(list: Transaction[], id: string, scope: "one" | "future" | "all"): string[] {
  const t = list.find((x) => x.id === id);
  if (!t) return [];
  return list.filter((x) => x.id === id ||
    (scope !== "one" && !!t.installmentGroupId && x.installmentGroupId === t.installmentGroupId &&
      (scope === "all" || (x.installmentNumber ?? 0) >= (t.installmentNumber ?? 0)))).map((x) => x.id);
}

/** Move entre ativos e lixeira no snapshot em memória. */
export function moveToTrash(d: Snapshot, ids: string[], when: string): Snapshot {
  const set = new Set(ids);
  const moved = d.transactions.filter((t) => set.has(t.id)).map((t) => ({ ...t, deletedAt: when }));
  return { ...d, transactions: d.transactions.filter((t) => !set.has(t.id)), trash: [...(d.trash ?? []), ...moved] };
}
export function moveFromTrash(d: Snapshot, ids: string[]): Snapshot {
  const set = new Set(ids);
  const back = (d.trash ?? []).filter((t) => set.has(t.id)).map((t) => ({ ...t, deletedAt: null }));
  return { ...d, trash: (d.trash ?? []).filter((t) => !set.has(t.id)), transactions: [...d.transactions, ...back] };
}
export function dropForever(d: Snapshot, ids: string[]): Snapshot {
  const set = new Set(ids);
  return { ...d, transactions: d.transactions.filter((t) => !set.has(t.id)), trash: (d.trash ?? []).filter((t) => !set.has(t.id)) };
}

/** Painel recomeçado no mesmo espaço: só a conta principal e as categorias padrão. */
export function freshSnapshot(workspace: Snapshot["workspace"], newId: () => string): Snapshot {
  const seed = emptySnapshot(newId);
  const own = <T extends { workspaceId: string }>(list: T[]) => list.map((x) => ({ ...x, workspaceId: workspace.id }));
  return { ...seed, workspace, accounts: own(seed.accounts), categories: own(seed.categories), trash: [] };
}

/** Lixeira guarda por 30 dias; ids que já passaram disso. */
export function expiredTrash(trash: Transaction[], now: Date, days = 30): string[] {
  const limit = new Date(now.getTime() - days * 86400000).toISOString();
  return trash.filter((t) => t.deletedAt && t.deletedAt < limit).map((t) => t.id);
}
