import type { Account, Activity, CashRegister, Order, ProLaboreWithdrawal, BusinessClient, ExpenseDetail, Receivable, Card, Category, Company, Workspace, WorkspaceKind, Debt, Reminder, Goal, GoalContribution, Investment, InvestmentGoal, NewTransactionInput, Person, Product, Quote, Service, StockMovement, Profile, Recurring, Snapshot, Transaction } from "../types";
import type { MoveInput } from "../stock";
import type { BioPage } from "../bio";
import type { SyncStatus } from "./outbox";
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
  /** Entrar com email e senha (só no modo online, para quem já criou senha). */
  signInWithPassword(email: string, password: string): Promise<void>;
  /** Perfil de quem está conectado; null = ainda não carregou ou não entrou. */
  profile(): Profile | null;
  updateProfile(p: Partial<Pick<Profile, "phone" | "location" | "avatar" | "whatsapp">>): Promise<void>;
  /** Cria ou troca a senha; `current` é obrigatória quando já existe uma. */
  changePassword(current: string | null, next: string): Promise<void>;
  /** Apaga o usuário e todos os dados dele, e sai. */
  deleteAccount(): Promise<void>;
  /** Mensagem quando os dados não carregaram depois de entrar; null = tudo certo. */
  loadError(): string | null;
  /** Tenta carregar os dados de novo depois de um erro. */
  retry(): void;
  /** Conexão e alterações feitas sem internet esperando envio. */
  syncStatus(): SyncStatus;
  dismissSyncError(): void;
  /** Busca de novo o que mudou no servidor (outro aparelho, outro sócio). */
  refresh(): Promise<void>;

  snapshot(): Snapshot | null;
  subscribe(listener: () => void): () => void;

  /** Troca entre o espaço pessoal e o da empresa (cada um com seus próprios dados). */
  switchWorkspace(kind: WorkspaceKind): Promise<void>;
  /** Cadastra a empresa: cria o espaço empresarial (conta principal e categorias) e entra nele. */
  createBusiness(c: Company): Promise<void>;
  /** Altera os dados da empresa do espaço atual. */
  updateCompany(c: Company): Promise<void>;

  /** Produtos do espaço atual (mais novos primeiro). */
  listProducts(): Promise<Product[]>;
  /** Cria ou altera um produto. */
  saveProduct(p: Product): Promise<void>;
  deleteProduct(id: string): Promise<void>;

  /** Serviços do espaço atual (mais novos primeiro). */
  listServices(): Promise<Service[]>;
  /** Cria ou altera um serviço. */
  saveService(s: Service): Promise<void>;
  deleteService(id: string): Promise<void>;

  /** Movimentações de estoque do mês ("2026-11"), mais novas primeiro. */
  listStockMovements(month: string): Promise<StockMovement[]>;
  /** Registra uma entrada ou saída e devolve o produto com o estoque atualizado. */
  moveStock(m: MoveInput): Promise<Product>;

  /** Orçamentos do espaço atual (mais novos primeiro). */
  listQuotes(): Promise<Quote[]>;
  /** Cria ou altera um orçamento. */
  saveQuote(q: Quote): Promise<void>;
  deleteQuote(id: string): Promise<void>;
  /** Orçamento aberto pelo link do cliente (sem login); marca como visualizado. */
  publicQuote(token: string): Promise<Quote | null>;
  /** Resposta do cliente pelo link: aprovar ou recusar. Devolve o orçamento atualizado. */
  respondQuote(token: string, accept: boolean): Promise<Quote | null>;

  /** Tipo, fornecedor e funcionário das despesas da empresa. */
  listExpenseDetails(): Promise<ExpenseDetail[]>;
  saveExpenseDetails(list: ExpenseDetail[]): Promise<void>;
  /** Guarda o comprovante (PDF, JPG ou PNG até 5MB) e devolve o caminho para salvar na despesa. */
  uploadReceipt(file: File): Promise<string>;
  /** Link temporário para abrir o comprovante. */
  receiptUrl(path: string): Promise<string>;

  /** Clientes da empresa (inclui os da lixeira, com deletedAt). */
  listClients(): Promise<BusinessClient[]>;
  /** Cria ou altera um cliente (mandar para a lixeira = deletedAt preenchido). */
  saveClient(c: BusinessClient): Promise<void>;
  /** Apaga de vez (as contas dele ficam sem cliente). */
  deleteClient(id: string): Promise<void>;
  /** Contas a receber (inclui as da lixeira). */
  listReceivables(): Promise<Receivable[]>;
  /** Cria ou altera várias contas de uma vez (parcelas). */
  saveReceivables(list: Receivable[]): Promise<void>;
  deleteReceivable(id: string): Promise<void>;

  /** Atividades da agenda do espaço atual (vencimento mais próximo primeiro). */
  listProLabore(): Promise<ProLaboreWithdrawal[]>;
  saveProLabore(w: ProLaboreWithdrawal): Promise<void>;
  deleteProLabore(id: string): Promise<void>;
  /** Contas do espaço pessoal (para creditar o pró-labore a partir da empresa). */
  personalAccounts(): Promise<{ id: string; name: string }[]>;
  /** Lança uma receita paga numa conta do espaço pessoal; devolve o id do lançamento. */
  creditPersonal(input: { accountId: string; amountCents: number; occurredOn: string; description: string }): Promise<string>;
  /** Manda para a lixeira um lançamento do espaço pessoal. */
  trashPersonal(txId: string): Promise<void>;
  listOrders(): Promise<Order[]>;
  saveOrder(o: Order): Promise<void>;
  deleteOrder(id: string): Promise<void>;
  /** Caixa Diário: um caixa por dia, com reforços e sangrias. */
  listCashRegisters(): Promise<CashRegister[]>;
  saveCashRegister(r: CashRegister): Promise<void>;
  deleteCashRegister(id: string): Promise<void>;
  listActivities(): Promise<Activity[]>;
  /** Cria ou altera uma atividade (inclusive a mudança de coluna). */
  saveActivity(a: Activity): Promise<void>;
  deleteActivity(id: string): Promise<void>;

  /** Link Bio do espaço atual; null = ainda não criado. */
  loadBio(): Promise<BioPage | null>;
  /** Grava o Link Bio (endereço único entre todos). */
  saveBio(p: BioPage): Promise<void>;
  /** Página pública pelo endereço; null = não existe ou está desativada. Não precisa estar conectado. */
  publicBio(slug: string): Promise<BioPage | null>;

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
  upsertReminder(r: Omit<Reminder, "workspaceId" | "id"> & { id?: string }): Promise<Reminder>;
  deleteReminder(id: string): Promise<void>;
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
  const seed = emptySnapshot(newId, companyOf(workspace) ?? undefined);
  const own = <T extends { workspaceId: string }>(list: T[]) => list.map((x) => ({ ...x, workspaceId: workspace.id }));
  return { ...seed, workspace, accounts: own(seed.accounts), categories: own(seed.categories), trash: [] };
}

/** Dados da empresa de um espaço empresarial; null no pessoal. */
export function companyOf(w: Workspace): Company | null {
  return w.kind === "business"
    ? { name: w.name, cnpj: w.cnpj ?? null, activity: w.activity ?? "", companyType: w.companyType ?? "outro", details: w.details ?? {} } : null;
}

/** Lixeira guarda por 30 dias; ids que já passaram disso. */
export function expiredTrash(trash: Transaction[], now: Date, days = 30): string[] {
  const limit = new Date(now.getTime() - days * 86400000).toISOString();
  return trash.filter((t) => t.deletedAt && t.deletedAt < limit).map((t) => t.id);
}
