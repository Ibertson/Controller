"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { buildTransactions } from "../transactions";
import type { Account, Card, Category, Debt, Reminder, Goal, GoalContribution, Investment, InvestmentGoal, NewTransactionInput, Person, Profile, Recurring, Snapshot, WhatsappNumber, Transaction } from "../types";
import { dropForever, freshSnapshot, moveFromTrash, moveToTrash, scopeIds, withoutGoal, type Repo, type SignInResult } from "./repo";
import { emptySnapshot } from "./seed";

// Banco: supabase/migrations. As colunas são snake_case; aqui viram camelCase.
type Row = Record<string, unknown>;

const toAccount = (r: Row): Account => ({
  id: r.id as string, workspaceId: r.workspace_id as string, name: r.name as string, kind: r.kind as Account["kind"],
  initialBalanceCents: Number(r.initial_balance_cents), archived: r.archived as boolean,
});
const fromAccount = (a: Account) => ({
  id: a.id, workspace_id: a.workspaceId, name: a.name, kind: a.kind, initial_balance_cents: a.initialBalanceCents, archived: a.archived,
});
const toCard = (r: Row): Card => ({
  id: r.id as string, workspaceId: r.workspace_id as string, name: r.name as string, limitCents: Number(r.limit_cents),
  closingDay: r.closing_day as number, dueDay: r.due_day as number, paymentAccountId: (r.payment_account_id as string) ?? null,
  archived: r.archived as boolean, bank: (r.bank as string) ?? null, last4: (r.last4 as string) ?? null,
  brand: (r.brand as string) ?? null, color: (r.color as string) ?? null, personId: (r.person_id as string) ?? null,
});
const fromCard = (c: Card) => ({
  id: c.id, workspace_id: c.workspaceId, name: c.name, limit_cents: c.limitCents, closing_day: c.closingDay, due_day: c.dueDay,
  payment_account_id: c.paymentAccountId, archived: c.archived,
  bank: c.bank ?? null, last4: c.last4 ?? null, brand: c.brand ?? null, color: c.color ?? null, person_id: c.personId ?? null,
});
const toCategory = (r: Row): Category => ({
  id: r.id as string, workspaceId: r.workspace_id as string, name: r.name as string, icon: (r.icon as string) ?? "",
  kind: r.kind as Category["kind"], monthlyLimitCents: r.monthly_limit_cents == null ? null : Number(r.monthly_limit_cents),
  archived: r.archived as boolean, color: (r.color as string | null) ?? null,
  parentId: (r.parent_id as string | null) ?? null,
});
const fromCategory = (c: Category) => ({
  id: c.id, workspace_id: c.workspaceId, name: c.name, icon: c.icon, kind: c.kind, monthly_limit_cents: c.monthlyLimitCents, archived: c.archived, color: c.color ?? null,
  parent_id: c.parentId ?? null,
});
const toPerson = (r: Row): Person => ({
  id: r.id as string, workspaceId: r.workspace_id as string, name: r.name as string,
  monthlyLimitCents: r.monthly_limit_cents == null ? null : Number(r.monthly_limit_cents), archived: r.archived as boolean,
});
const fromPerson = (p: Person) => ({
  id: p.id, workspace_id: p.workspaceId, name: p.name, monthly_limit_cents: p.monthlyLimitCents, archived: p.archived,
});
const toTransaction = (r: Row): Transaction => ({
  id: r.id as string, workspaceId: r.workspace_id as string, kind: r.kind as Transaction["kind"], amountCents: Number(r.amount_cents),
  occurredOn: r.occurred_on as string, description: r.description as string,
  categoryId: (r.category_id as string) ?? null, accountId: (r.account_id as string) ?? null, toAccountId: (r.to_account_id as string) ?? null,
  cardId: (r.card_id as string) ?? null, statementMonth: (r.statement_month as string) ?? null, personId: (r.person_id as string) ?? null,
  installmentGroupId: (r.installment_group_id as string) ?? null, installmentNumber: (r.installment_number as number) ?? null,
  installmentTotal: (r.installment_total as number) ?? null, isPaid: r.is_paid as boolean, dueOn: (r.due_on as string) ?? null,
  source: r.source as Transaction["source"], createdAt: r.created_at as string, deletedAt: (r.deleted_at as string) ?? null,
  recurringId: (r.recurring_id as string) ?? null,
});
const fromTransaction = (t: Transaction) => ({
  id: t.id, workspace_id: t.workspaceId, kind: t.kind, amount_cents: t.amountCents, occurred_on: t.occurredOn, description: t.description,
  category_id: t.categoryId, account_id: t.accountId, to_account_id: t.toAccountId, card_id: t.cardId, statement_month: t.statementMonth,
  person_id: t.personId, installment_group_id: t.installmentGroupId, installment_number: t.installmentNumber,
  installment_total: t.installmentTotal, is_paid: t.isPaid, due_on: t.dueOn, source: t.source, recurring_id: t.recurringId ?? null,
});
const toRecurring = (r: Row): Recurring => ({
  id: r.id as string, workspaceId: r.workspace_id as string, kind: r.kind as Recurring["kind"], description: r.description as string,
  amountCents: Number(r.amount_cents), day: r.day as number, categoryId: (r.category_id as string) ?? null,
  accountId: (r.account_id as string) ?? null, personId: (r.person_id as string) ?? null,
  startMonth: r.start_month as string, active: r.active as boolean,
});
const toGoal = (r: Row): Goal => ({
  id: r.id as string, workspaceId: r.workspace_id as string, name: r.name as string, description: (r.description as string) ?? "",
  targetCents: Number(r.target_cents), targetDate: (r.target_date as string) ?? null, status: r.status as Goal["status"],
  category: (r.category as Goal["category"]) ?? "outro", personId: (r.person_id as string) ?? null, color: (r.color as string) ?? null,
  image: (r.image as string) ?? null, imagePosition: (r.image_position as Goal["imagePosition"]) ?? "center",
  createdAt: r.created_at as string, completedAt: (r.completed_at as string) ?? null,
});
const fromGoal = (g: Goal) => ({
  id: g.id, workspace_id: g.workspaceId, name: g.name, description: g.description, target_cents: g.targetCents, target_date: g.targetDate,
  status: g.status, category: g.category, person_id: g.personId, color: g.color, image: g.image, image_position: g.imagePosition,
  completed_at: g.completedAt,
});
const toContribution = (r: Row): GoalContribution => ({
  id: r.id as string, goalId: r.goal_id as string, workspaceId: r.workspace_id as string, amountCents: Number(r.amount_cents),
  contributedOn: r.contributed_on as string, personId: (r.person_id as string) ?? null,
});
const toInvestment = (r: Row): Investment => ({
  id: r.id as string, workspaceId: r.workspace_id as string, name: r.name as string, type: r.type as Investment["type"],
  institution: (r.institution as string) ?? "", investedCents: Number(r.invested_cents),
  currentCents: r.current_cents == null ? null : Number(r.current_cents), incomeCents: Number(r.income_cents ?? 0),
  rate: r.rate == null ? null : Number(r.rate), boughtOn: r.bought_on as string, maturityOn: (r.maturity_on as string) ?? null,
  notes: (r.notes as string) ?? "",
});
const fromInvestment = (i: Investment) => ({
  id: i.id, workspace_id: i.workspaceId, name: i.name, type: i.type, institution: i.institution, invested_cents: i.investedCents,
  current_cents: i.currentCents, income_cents: i.incomeCents, rate: i.rate, bought_on: i.boughtOn, maturity_on: i.maturityOn, notes: i.notes,
});
const toInvestmentGoal = (r: Row): InvestmentGoal => ({
  id: r.id as string, workspaceId: r.workspace_id as string, name: r.name as string, targetCents: Number(r.target_cents),
  assetType: (r.asset_type as InvestmentGoal["assetType"]) ?? null, deadline: (r.deadline as string) ?? null,
  description: (r.description as string) ?? "",
});
const fromInvestmentGoal = (g: InvestmentGoal) => ({
  id: g.id, workspace_id: g.workspaceId, name: g.name, target_cents: g.targetCents, asset_type: g.assetType,
  deadline: g.deadline, description: g.description,
});
const num = (v: unknown) => (v == null ? null : Number(v));
const toDebt = (r: Row): Debt => ({
  id: r.id as string, workspaceId: r.workspace_id as string, name: r.name as string, creditor: (r.creditor as string) ?? "",
  type: (r.type as Debt["type"]) ?? "outro", totalCents: Number(r.total_cents ?? 0), installmentCents: Number(r.installment_cents),
  installmentsTotal: r.installments_total as number, installmentsPaid: r.installments_paid as number,
  startOn: r.start_on as string, dueDay: (r.due_day as number) ?? 10, interestRate: num(r.interest_rate),
  category: (r.category as string) ?? null, personId: (r.person_id as string) ?? null,
  selfResponsible: !!r.self_responsible, assetDescription: (r.asset_description as string) ?? "", commissionCents: Number(r.commission_cents ?? 0), commissionPct: num(r.commission_pct),
  seller: (r.seller as string) ?? "", assetFinalCents: num(r.asset_final_cents), monthsToReady: num(r.months_to_ready),
  extraCosts: (r.extra_costs as Debt["extraCosts"]) ?? [], notes: (r.notes as string) ?? "", createdAt: r.created_at as string,
});
const fromDebt = (d: Debt) => ({
  id: d.id, workspace_id: d.workspaceId, name: d.name, creditor: d.creditor || null, type: d.type, total_cents: d.totalCents,
  installment_cents: d.installmentCents, installments_total: d.installmentsTotal, installments_paid: d.installmentsPaid,
  start_on: d.startOn, due_day: d.dueDay, interest_rate: d.interestRate, category: d.category, person_id: d.personId,
  self_responsible: d.selfResponsible,
  asset_description: d.assetDescription, commission_cents: d.commissionCents, commission_pct: d.commissionPct, seller: d.seller,
  asset_final_cents: d.assetFinalCents, months_to_ready: d.monthsToReady, extra_costs: d.extraCosts, notes: d.notes,
});
const toReminder = (r: Row): Reminder => ({
  id: r.id as string, workspaceId: r.workspace_id as string, title: r.title as string, type: r.type as Reminder["type"],
  dueOn: r.due_on as string, repeatDays: Number(r.repeat_days ?? 0) as Reminder["repeatDays"], personId: (r.person_id as string) ?? null,
  notes: (r.notes as string) ?? "", whatsapp: (r.whatsapp as string) ?? null,
  doneAt: (r.done_at as string) ?? null, lastDoneOn: (r.last_done_on as string) ?? null,
});
const fromReminder = (x: Reminder) => ({
  id: x.id, workspace_id: x.workspaceId, title: x.title, type: x.type, due_on: x.dueOn, repeat_days: x.repeatDays,
  person_id: x.personId, notes: x.notes, whatsapp: x.whatsapp, done_at: x.doneAt, last_done_on: x.lastDoneOn,
});
const fromRecurring = (r: Recurring) => ({
  id: r.id, workspace_id: r.workspaceId, kind: r.kind, description: r.description, amount_cents: r.amountCents, day: r.day,
  category_id: r.categoryId, account_id: r.accountId, person_id: r.personId, start_month: r.startMonth, active: r.active,
});

const newId = () => crypto.randomUUID();

/** Listas de ids em pedaços, para o filtro "in" não estourar o tamanho da URL. */
function chunks(ids: string[], size = 100): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size));
  return out;
}

function must<T>(res: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (res.error) throw new Error(res.error.message);
  return res.data as NonNullable<T>;
}

/**
 * Dados no Supabase com login por link no email. Carrega o espaço inteiro ao entrar
 * (uso pessoal: poucos milhares de linhas) e mantém uma cópia em memória para as telas.
 */
export class SupabaseRepo implements Repo {
  readonly mode = "supabase" as const;
  private db: SupabaseClient;
  private user: { id: string; name: string; email: string | null; createdAt: string; hasPassword: boolean } | null | undefined = undefined; // undefined = ainda verificando
  private prof: Profile | null = null;
  private data: Snapshot | null = null;
  private listeners = new Set<() => void>();
  private keys = new Set<string>();
  private started = false;
  private failure: string | null = null;

  constructor(url: string, key: string) {
    // "implicit": o link do email funciona mesmo se abrir em outro navegador (ex.: app do Gmail no celular);
    // com "pkce" o link só vale no mesmo navegador que pediu.
    this.db = createClient(url, key, { auth: { flowType: "implicit", persistSession: true, detectSessionInUrl: true } });
  }

  private emit() { this.listeners.forEach((l) => l()); }

  private start() {
    if (this.started || typeof window === "undefined") return;
    this.started = true;
    this.db.auth.onAuthStateChange((_event, session) => {
      const u = session?.user;
      if (!u) { this.user = null; this.data = null; this.prof = null; this.failure = null; this.emit(); return; }
      if (this.user?.id === u.id && this.data) return;
      this.user = {
        id: u.id, name: (u.user_metadata?.name as string) || u.email?.split("@")[0] || "você",
        email: u.email ?? null, createdAt: u.created_at, hasPassword: u.user_metadata?.has_password === true,
      };
      // fora do callback: o supabase-js não deve ser chamado de dentro dele
      setTimeout(() => this.reload(), 0);
    });
  }

  private reload() {
    this.failure = null;
    this.emit();
    this.load().catch((e) => {
      console.error("Falha ao carregar dados", e);
      this.failure = e instanceof Error ? e.message : String(e);
      this.emit();
    });
  }

  loadError() { return this.failure; }
  retry() { if (this.user) this.reload(); }

  private async load() {
    const uid = this.user!.id;
    const settings = await this.db.from("user_settings").select("default_workspace_id").eq("user_id", uid).maybeSingle();
    if (settings.error) throw new Error(settings.error.message);
    let wsId = settings.data?.default_workspace_id as string | undefined;
    if (!wsId) {
      const own = must(await this.db.from("workspaces").select("id").eq("owner_id", uid).eq("kind", "personal").order("created_at").limit(1));
      wsId = own[0]?.id;
    }
    if (!wsId) wsId = await this.createPersonalWorkspace(uid);

    const [ws, accounts, cards, categories, people, transactions, recurring, goals, contributions, investments, investmentGoals, debts, reminders] = await Promise.all([
      this.db.from("workspaces").select("id,name,currency").eq("id", wsId).single(),
      this.all("accounts", wsId), this.all("cards", wsId), this.all("categories", wsId),
      this.all("people", wsId), this.all("transactions", wsId), this.all("recurring", wsId),
      this.all("goals", wsId), this.all("goal_contributions", wsId),
      this.all("investments", wsId), this.all("investment_goals", wsId), this.all("debts", wsId), this.all("reminders", wsId),
    ]);
    const w = must(ws);
    await this.loadProfile();
    this.data = {
      workspace: { id: w.id, name: w.name, currency: "BRL" },
      accounts: accounts.map(toAccount),
      cards: cards.map(toCard),
      categories: categories.map(toCategory),
      people: people.map(toPerson),
      transactions: transactions.map(toTransaction).filter((t) => !t.deletedAt),
      trash: transactions.map(toTransaction).filter((t) => !!t.deletedAt),
      recurring: recurring.map(toRecurring),
      goals: goals.map(toGoal),
      goalContributions: contributions.map(toContribution),
      investments: investments.map(toInvestment),
      investmentGoals: investmentGoals.map(toInvestmentGoal),
      debts: debts.map(toDebt),
      reminders: reminders.map(toReminder),
    };
    this.emit();
  }

  /** Perfil não impede o painel de abrir: sem a linha (ou sem a tabela) usa os valores vazios. */
  private async loadProfile() {
    const u = this.user!;
    const r = await this.db.from("profiles").select("phone,location,avatar,whatsapp").eq("user_id", u.id).maybeSingle();
    if (r.error) console.error("Falha ao carregar perfil", r.error);
    const row = (r.data ?? {}) as Row;
    this.prof = {
      email: u.email, memberSince: u.createdAt.slice(0, 10), hasPassword: u.hasPassword,
      phone: (row.phone as string) ?? "", location: (row.location as string) ?? "",
      avatar: (row.avatar as string | null) ?? null, whatsapp: (row.whatsapp as WhatsappNumber[]) ?? [],
    };
  }

  /** Lê a tabela inteira do espaço em páginas (o Supabase devolve no máximo 1000 linhas por pedido). */
  private async all(table: string, wsId: string): Promise<Row[]> {
    const out: Row[] = [];
    for (let from = 0; ; from += 1000) {
      const page = must(await this.db.from(table).select("*").eq("workspace_id", wsId).order("id").range(from, from + 999)) as Row[];
      out.push(...page);
      if (page.length < 1000) return out;
    }
  }

  /** Primeiro acesso: cria o espaço pessoal com uma conta e as categorias iniciais. */
  private async createPersonalWorkspace(uid: string): Promise<string> {
    const seed = emptySnapshot(newId);
    const wsId = seed.workspace.id;
    must(await this.db.from("workspaces").insert({ id: wsId, owner_id: uid, kind: "personal", name: seed.workspace.name }));
    must(await this.db.from("accounts").insert(seed.accounts.map(fromAccount)));
    must(await this.db.from("categories").insert(seed.categories.map(fromCategory)));
    must(await this.db.from("user_settings").upsert({ user_id: uid, default_workspace_id: wsId }));
    return wsId;
  }

  // undefined = verificando ou carregando dados; mesmo objeto enquanto nada muda (useSyncExternalStore exige)
  private sess: { name: string } | null | undefined = undefined;
  session() {
    this.start();
    const next = this.user === null ? null : this.user && this.data ? this.user.name : undefined;
    if (next === null || next === undefined) this.sess = next;
    else if (this.sess?.name !== next) this.sess = { name: next };
    return this.sess;
  }
  snapshot() { this.start(); return this.data; }
  subscribe(l: () => void) { this.start(); this.listeners.add(l); return () => { this.listeners.delete(l); }; }

  async signIn(email: string): Promise<SignInResult> {
    const { error } = await this.db.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin + "/" },
    });
    if (error) throw new Error(error.message);
    return "check_email";
  }
  async signOut() { await this.db.auth.signOut(); }

  async signInWithPassword(email: string, password: string) {
    const { error } = await this.db.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw new Error(/invalid/i.test(error.message) ? "Email ou senha incorretos." : error.message);
  }

  profile() { this.start(); return this.prof; }

  async updateProfile(p: Parameters<Repo["updateProfile"]>[0]) {
    if (!this.user || !this.prof) throw new Error("não autenticado");
    const next = { ...this.prof, ...p };
    must(await this.db.from("profiles").upsert({
      user_id: this.user.id, phone: next.phone, location: next.location, avatar: next.avatar, whatsapp: next.whatsapp,
    }));
    this.prof = next; this.emit();
  }

  async changePassword(current: string | null, next: string) {
    const u = this.user;
    if (!u || !u.email) throw new Error("não autenticado");
    if (u.hasPassword) {
      if (!current) throw new Error("Informe a senha atual.");
      const check = await this.db.auth.signInWithPassword({ email: u.email, password: current });
      if (check.error) throw new Error("A senha atual não confere.");
    }
    const { error } = await this.db.auth.updateUser({ password: next, data: { has_password: true } });
    if (error) throw new Error(/different/i.test(error.message) ? "A nova senha precisa ser diferente da atual." : error.message);
    this.user = { ...u, hasPassword: true };
    if (this.prof) this.prof = { ...this.prof, hasPassword: true };
    this.emit();
  }

  async deleteAccount() {
    const { error } = await this.db.rpc("delete_my_account");
    // PGRST202: a função ainda não foi criada no banco
    if (error) throw new Error(error.code === "PGRST202" ? "A exclusão de conta ainda não foi ativada no banco. Nada foi apagado." : error.message);
    await this.db.auth.signOut();
  }

  async renameSelf(name: string) {
    const { error } = await this.db.auth.updateUser({ data: { name } });
    if (error) throw new Error(error.message);
    if (this.user) { this.user = { ...this.user, name }; this.emit(); }
  }

  private set(fn: (d: Snapshot) => Snapshot) { this.data = fn(this.data!); this.emit(); }

  async createTransaction(input: NewTransactionInput) {
    const d = this.data!;
    if (input.idempotencyKey && this.keys.has(input.idempotencyKey)) return [];
    const card = input.cardId ? d.cards.find((c) => c.id === input.cardId) : undefined;
    for (const [id, list] of [[input.accountId, d.accounts], [input.toAccountId, d.accounts], [input.categoryId, d.categories], [input.personId, d.people]] as const) {
      if (id && !list.some((x) => x.id === id)) throw new Error("registro de outro espaço ou inexistente");
    }
    const rows = buildTransactions(input, { workspaceId: d.workspace.id, card, newId, now: new Date().toISOString() });
    if (input.idempotencyKey) this.keys.add(input.idempotencyKey);
    try {
      must(await this.db.from("transactions").insert(rows.map(fromTransaction)));
    } catch (e) {
      if (input.idempotencyKey) this.keys.delete(input.idempotencyKey);
      throw e;
    }
    this.set((x) => ({ ...x, transactions: [...x.transactions, ...rows] }));
    return rows;
  }

  async deleteTransaction(id: string, scope: "one" | "future" | "all") {
    await this.trashTransactions(scopeIds(this.data!.transactions, id, scope));
  }
  async trashTransactions(ids: string[]) {
    if (!ids.length) return;
    const when = new Date().toISOString();
    for (const chunk of chunks(ids)) must(await this.db.from("transactions").update({ deleted_at: when }).in("id", chunk));
    this.set((d) => moveToTrash(d, ids, when));
  }
  async restoreTransactions(ids: string[]) {
    if (!ids.length) return;
    for (const chunk of chunks(ids)) must(await this.db.from("transactions").update({ deleted_at: null }).in("id", chunk));
    this.set((d) => moveFromTrash(d, ids));
  }
  async purgeTransactions(ids: string[]) {
    if (!ids.length) return;
    for (const chunk of chunks(ids)) must(await this.db.from("transactions").delete().in("id", chunk));
    this.set((d) => dropForever(d, ids));
  }

  async resetAll() {
    const ws = this.data!.workspace;
    // Ordem das chaves estrangeiras: lançamentos antes de contas, cartões, categorias e pessoas.
    for (const table of ["transactions", "recurring", "goal_contributions", "goals", "investments", "investment_goals", "debts", "reminders", "month_closings", "cards", "accounts", "categories", "people"]) {
      must(await this.db.from(table).delete().eq("workspace_id", ws.id));
    }
    const fresh = freshSnapshot(ws, newId);
    must(await this.db.from("accounts").insert(fresh.accounts.map(fromAccount)));
    must(await this.db.from("categories").insert(fresh.categories.map(fromCategory)));
    this.set(() => fresh);
  }

  async markPaid(id: string, accountId?: string) {
    const patch: Row = { is_paid: true, due_on: null };
    if (accountId) patch.account_id = accountId;
    must(await this.db.from("transactions").update(patch).eq("id", id));
    this.set((d) => ({ ...d, transactions: d.transactions.map((t) => (t.id === id ? { ...t, isPaid: true, dueOn: null, accountId: accountId ?? t.accountId } : t)) }));
  }

  private async upsert<K extends "accounts" | "cards" | "categories" | "people" | "recurring" | "goals" | "investments" | "investmentGoals" | "debts" | "reminders", T extends NonNullable<Snapshot[K]>[number]>(
    key: K, item: Omit<T, "workspaceId" | "id"> & { id?: string }, toRow: (x: T) => Row,
  ): Promise<T> {
    const saved = { ...item, id: item.id ?? newId(), workspaceId: this.data!.workspace.id } as T;
    must(await this.db.from(key === "investmentGoals" ? "investment_goals" : key).upsert(toRow(saved)));
    this.set((d) => {
      const list = (d[key] ?? []) as T[];
      return { ...d, [key]: list.some((x) => x.id === saved.id) ? list.map((x) => (x.id === saved.id ? saved : x)) : [...list, saved] };
    });
    return saved;
  }
  upsertAccount(a: Parameters<Repo["upsertAccount"]>[0]) { return this.upsert<"accounts", Account>("accounts", a, fromAccount); }
  upsertCard(c: Parameters<Repo["upsertCard"]>[0]) { return this.upsert<"cards", Card>("cards", c, fromCard); }
  upsertCategory(c: Parameters<Repo["upsertCategory"]>[0]) { return this.upsert<"categories", Category>("categories", c, fromCategory); }
  upsertPerson(p: Parameters<Repo["upsertPerson"]>[0]) { return this.upsert<"people", Person>("people", p, fromPerson); }
  upsertGoal(g: Parameters<Repo["upsertGoal"]>[0]) {
    const old = (this.data!.goals ?? []).find((x) => x.id === g.id);
    return this.upsert<"goals", Goal>("goals", { ...g, createdAt: old?.createdAt ?? new Date().toISOString() }, fromGoal);
  }
  async deleteGoal(id: string) {
    must(await this.db.from("goals").delete().eq("id", id));
    this.set((d) => withoutGoal(d, id));
  }
  async addContribution(c: Parameters<Repo["addContribution"]>[0]) {
    const saved: GoalContribution = { ...c, id: newId(), workspaceId: this.data!.workspace.id };
    must(await this.db.from("goal_contributions").insert({
      id: saved.id, goal_id: saved.goalId, workspace_id: saved.workspaceId, amount_cents: saved.amountCents,
      contributed_on: saved.contributedOn, person_id: saved.personId,
    }));
    this.set((d) => ({ ...d, goalContributions: [...(d.goalContributions ?? []), saved] }));
    return saved;
  }
  upsertRecurring(r: Parameters<Repo["upsertRecurring"]>[0]) { return this.upsert<"recurring", Recurring>("recurring", r, fromRecurring); }
  upsertInvestment(i: Parameters<Repo["upsertInvestment"]>[0]) { return this.upsert<"investments", Investment>("investments", i, fromInvestment); }
  async deleteInvestment(id: string) {
    must(await this.db.from("investments").delete().eq("id", id));
    this.set((d) => ({ ...d, investments: (d.investments ?? []).filter((x) => x.id !== id) }));
  }
  upsertInvestmentGoal(g: Parameters<Repo["upsertInvestmentGoal"]>[0]) {
    return this.upsert<"investmentGoals", InvestmentGoal>("investmentGoals", g, fromInvestmentGoal);
  }
  upsertDebt(x: Parameters<Repo["upsertDebt"]>[0]) {
    const old = (this.data!.debts ?? []).find((d) => d.id === x.id);
    return this.upsert<"debts", Debt>("debts", { ...x, createdAt: old?.createdAt ?? new Date().toISOString() }, fromDebt);
  }
  upsertReminder(r: Parameters<Repo["upsertReminder"]>[0]) { return this.upsert<"reminders", Reminder>("reminders", r, fromReminder); }
  async deleteReminder(id: string) {
    must(await this.db.from("reminders").delete().eq("id", id));
    this.set((d) => ({ ...d, reminders: (d.reminders ?? []).filter((x) => x.id !== id) }));
  }
  async deleteDebt(id: string) {
    must(await this.db.from("debts").delete().eq("id", id));
    this.set((d) => ({ ...d, debts: (d.debts ?? []).filter((x) => x.id !== id) }));
  }
  async deleteInvestmentGoal(id: string) {
    must(await this.db.from("investment_goals").delete().eq("id", id));
    this.set((d) => ({ ...d, investmentGoals: (d.investmentGoals ?? []).filter((x) => x.id !== id) }));
  }
  async deleteRecurring(id: string) {
    must(await this.db.from("recurring").delete().eq("id", id));
    this.set((d) => ({
      ...d, recurring: (d.recurring ?? []).filter((r) => r.id !== id),
      transactions: d.transactions.map((t) => (t.recurringId === id ? { ...t, recurringId: null } : t)),
    }));
  }
}
