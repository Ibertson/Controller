"use client";

import { buildTransactions } from "../transactions";
import type { Company, GoalContribution, Product, Profile, Snapshot, WorkspaceKind } from "../types";
import { today } from "../dates";
import { dropForever, freshSnapshot, moveFromTrash, moveToTrash, scopeIds, withoutGoal, type Repo, type SignInResult } from "./repo";
import type { BioPage } from "../bio";
import type { SyncStatus } from "./outbox";
import { emptySnapshot } from "./seed";

const KEY = "sobra:v1";
const SYNCED: SyncStatus = { online: true, pending: 0, syncing: false, error: null };
const newId = () => crypto.randomUUID();

type LocalProfile = Omit<Profile, "email" | "hasPassword">;
/** spaces = espaços guardados que não estão abertos agora (pessoal ou empresa). */
interface Stored { session: { name: string } | null; data: Snapshot | null; keys: string[]; profile?: LocalProfile; spaces?: Record<string, Snapshot> }

const kindOf = (s: Snapshot) => s.workspace.kind ?? "personal";
/** Lista de espaços, sempre guardada junto do espaço aberto. */
function withList(open: Snapshot, others: Snapshot[]): Snapshot {
  const workspaces = [open, ...others].map((s) => ({ id: s.workspace.id, kind: kindOf(s), name: s.workspace.name }))
    .sort((a, b) => (a.kind === "personal" ? -1 : 1) - (b.kind === "personal" ? -1 : 1));
  return { ...open, workspaces };
}

/** Guarda tudo no navegador. Serve para usar já, sem servidor; dados ficam só neste aparelho. */
const BIO_KEY = "sobra:bio";
const PRODUCTS_KEY = "sobra:products";

export class LocalRepo implements Repo {
  readonly mode = "local" as const;
  private state: Stored = { session: null, data: null, keys: [] };
  private listeners = new Set<() => void>();
  private loaded = false;

  private load() {
    if (this.loaded || typeof window === "undefined") return;
    this.loaded = true;
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) this.state = JSON.parse(raw);
    } catch { /* sem armazenamento: segue em memória */ }
  }

  private commit(next: Stored) {
    this.state = next;
    try { window.localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* idem */ }
    this.listeners.forEach((l) => l());
  }

  private data(): Snapshot {
    this.load();
    if (!this.state.data) throw new Error("não autenticado");
    return this.state.data;
  }

  private update(fn: (d: Snapshot) => Snapshot) {
    this.commit({ ...this.state, data: fn(this.data()) });
  }

  session() { this.load(); return this.state.session; }
  snapshot() { this.load(); return this.state.data; }
  subscribe(l: () => void) { this.listeners.add(l); return () => { this.listeners.delete(l); }; }

  async signIn(name: string): Promise<SignInResult> {
    this.load();
    this.commit({
      ...this.state, session: { name: name.trim() }, data: this.state.data ?? emptySnapshot(newId),
      profile: this.state.profile ?? { memberSince: today(), phone: "", location: "", avatar: null, whatsapp: [] },
    });
    return "signed_in";
  }
  loadError() { return null; }
  retry() {}
  // Tudo já fica neste aparelho: nada para sincronizar.
  syncStatus() { return SYNCED; }
  dismissSyncError() {}
  async signOut() { this.commit({ ...this.state, session: null }); }
  async renameSelf(name: string) { this.load(); this.commit({ ...this.state, session: { name } }); }
  async signInWithPassword(): Promise<void> { throw new Error("Neste modo não há senha: os dados ficam só neste aparelho."); }

  private prof: Profile | null = null;
  private profSrc: LocalProfile | undefined;
  profile() {
    this.load();
    if (!this.state.session) return null;
    // mesmo objeto enquanto o perfil guardado não muda (useSyncExternalStore exige)
    if (!this.prof || this.state.profile !== this.profSrc) {
      this.profSrc = this.state.profile;
      const base = this.profSrc ?? { memberSince: today(), phone: "", location: "", avatar: null, whatsapp: [] };
      this.prof = { ...base, email: null, hasPassword: false };
    }
    return this.prof;
  }
  async updateProfile(p: Parameters<Repo["updateProfile"]>[0]) {
    const cur = this.profile();
    if (!cur) throw new Error("não autenticado");
    const { memberSince, phone, location, avatar, whatsapp } = { ...cur, ...p };
    this.commit({ ...this.state, profile: { memberSince, phone, location, avatar, whatsapp } });
  }
  async changePassword(): Promise<void> { throw new Error("Neste modo não há senha: os dados ficam só neste aparelho."); }
  async deleteAccount() { this.commit({ session: null, data: null, keys: [] }); }

  async switchWorkspace(kind: WorkspaceKind) {
    const cur = this.data();
    if (kindOf(cur) === kind) return;
    const spaces = { ...(this.state.spaces ?? {}) };
    const target = Object.values(spaces).find((s) => kindOf(s) === kind);
    if (!target) throw new Error(kind === "business" ? "Cadastre a empresa primeiro." : "Espaço pessoal não encontrado.");
    delete spaces[target.workspace.id];
    spaces[cur.workspace.id] = cur;
    this.commit({ ...this.state, spaces, data: withList(target, Object.values(spaces)) });
  }
  async createBusiness(c: Company) {
    const cur = this.data();
    if ([cur, ...Object.values(this.state.spaces ?? {})].some((s) => kindOf(s) === "business")) throw new Error("A empresa já está cadastrada.");
    const biz = emptySnapshot(newId, c);
    const spaces = { ...(this.state.spaces ?? {}), [cur.workspace.id]: cur };
    this.commit({ ...this.state, spaces, data: withList(biz, Object.values(spaces)) });
  }
  // Link Bio fica numa chave própria: a página pública lê sem precisar entrar.
  private bios(): Record<string, BioPage> {
    try { return JSON.parse(localStorage.getItem(BIO_KEY) ?? "{}") as Record<string, BioPage>; } catch { return {}; }
  }
  async loadBio() {
    const ws = this.data().workspace.id;
    return this.bios()[ws] ?? null;
  }
  async saveBio(p: BioPage) {
    const ws = this.data().workspace.id;
    const all = this.bios();
    if (Object.entries(all).some(([id, b]) => id !== ws && b.slug === p.slug)) throw new Error("Esse endereço já está em uso. Escolha outro.");
    all[ws] = p;
    try { localStorage.setItem(BIO_KEY, JSON.stringify(all)); }
    catch { throw new Error("Sem espaço neste aparelho. Use imagens menores."); }
  }
  private allProducts(): Record<string, Product[]> {
    try { return JSON.parse(localStorage.getItem(PRODUCTS_KEY) ?? "{}") as Record<string, Product[]>; } catch { return {}; }
  }
  private putProducts(list: Product[]) {
    const all = this.allProducts();
    all[this.data().workspace.id] = list;
    try { localStorage.setItem(PRODUCTS_KEY, JSON.stringify(all)); }
    catch { throw new Error("Sem espaço neste aparelho. Use fotos menores."); }
  }
  async listProducts() {
    return [...(this.allProducts()[this.data().workspace.id] ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async saveProduct(p: Product) {
    const list = await this.listProducts();
    this.putProducts(list.some((x) => x.id === p.id) ? list.map((x) => (x.id === p.id ? p : x)) : [p, ...list]);
  }
  async deleteProduct(id: string) {
    this.putProducts((await this.listProducts()).filter((x) => x.id !== id));
  }

  async publicBio(slug: string) {
    return Object.values(this.bios()).find((b) => b.slug === slug && b.published) ?? null;
  }

  async updateCompany(c: Company) {
    this.update((d) => {
      const workspace = { ...d.workspace, name: c.name, cnpj: c.cnpj, activity: c.activity, companyType: c.companyType, details: c.details ?? {} };
      return { ...d, workspace, workspaces: (d.workspaces ?? []).map((w) => (w.id === workspace.id ? { ...w, name: c.name } : w)) };
    });
  }

  async createTransaction(input: Parameters<Repo["createTransaction"]>[0]) {
    const d = this.data();
    if (input.idempotencyKey && this.state.keys.includes(input.idempotencyKey)) return [];
    const card = input.cardId ? d.cards.find((c) => c.id === input.cardId) : undefined;
    for (const [id, list] of [[input.accountId, d.accounts], [input.toAccountId, d.accounts], [input.categoryId, d.categories], [input.personId, d.people]] as const) {
      if (id && !list.some((x) => x.id === id)) throw new Error("registro de outro espaço ou inexistente");
    }
    const rows = buildTransactions(input, { workspaceId: d.workspace.id, card, newId, now: new Date().toISOString() });
    this.commit({
      ...this.state,
      keys: input.idempotencyKey ? [...this.state.keys.slice(-50), input.idempotencyKey] : this.state.keys,
      data: { ...d, transactions: [...d.transactions, ...rows] },
    });
    return rows;
  }

  async deleteTransaction(id: string, scope: "one" | "future" | "all") {
    await this.trashTransactions(scopeIds(this.data().transactions, id, scope));
  }
  async trashTransactions(ids: string[]) { this.update((d) => moveToTrash(d, ids, new Date().toISOString())); }
  async restoreTransactions(ids: string[]) { this.update((d) => moveFromTrash(d, ids)); }
  async purgeTransactions(ids: string[]) { this.update((d) => dropForever(d, ids)); }
  async resetAll() { this.update((d) => freshSnapshot(d.workspace, newId)); }

  async markPaid(id: string, accountId?: string) {
    this.update((d) => ({
      ...d,
      transactions: d.transactions.map((t) => (t.id === id ? { ...t, isPaid: true, dueOn: null, accountId: accountId ?? t.accountId } : t)),
    }));
  }

  private upsert<K extends "accounts" | "cards" | "categories" | "people" | "recurring" | "goals" | "investments" | "investmentGoals" | "debts" | "reminders">(key: K, item: { id?: string; [k: string]: unknown }) {
    let saved!: NonNullable<Snapshot[K]>[number];
    this.update((d) => {
      const id = item.id ?? newId();
      saved = { ...item, id, workspaceId: d.workspace.id } as NonNullable<Snapshot[K]>[number];
      const list = (d[key] ?? []) as NonNullable<Snapshot[K]>[number][];
      const exists = list.some((x) => x.id === id);
      return { ...d, [key]: exists ? list.map((x) => (x.id === id ? saved : x)) : [...list, saved] };
    });
    return Promise.resolve(saved);
  }
  upsertAccount(a: Parameters<Repo["upsertAccount"]>[0]) { return this.upsert("accounts", a) as ReturnType<Repo["upsertAccount"]>; }
  upsertCard(c: Parameters<Repo["upsertCard"]>[0]) { return this.upsert("cards", c) as ReturnType<Repo["upsertCard"]>; }
  upsertCategory(c: Parameters<Repo["upsertCategory"]>[0]) { return this.upsert("categories", c) as ReturnType<Repo["upsertCategory"]>; }
  upsertPerson(p: Parameters<Repo["upsertPerson"]>[0]) { return this.upsert("people", p) as ReturnType<Repo["upsertPerson"]>; }
  upsertGoal(g: Parameters<Repo["upsertGoal"]>[0]) {
    const old = (this.snapshot()?.goals ?? []).find((x) => x.id === g.id);
    return this.upsert("goals", { ...g, createdAt: old?.createdAt ?? new Date().toISOString() }) as ReturnType<Repo["upsertGoal"]>;
  }
  async deleteGoal(id: string) { this.update((d) => withoutGoal(d, id)); }
  async addContribution(c: Parameters<Repo["addContribution"]>[0]) {
    let saved!: GoalContribution;
    this.update((d) => {
      saved = { ...c, id: newId(), workspaceId: d.workspace.id };
      return { ...d, goalContributions: [...(d.goalContributions ?? []), saved] };
    });
    return saved;
  }
  upsertRecurring(r: Parameters<Repo["upsertRecurring"]>[0]) { return this.upsert("recurring", r) as ReturnType<Repo["upsertRecurring"]>; }
  upsertInvestment(i: Parameters<Repo["upsertInvestment"]>[0]) { return this.upsert("investments", i) as ReturnType<Repo["upsertInvestment"]>; }
  async deleteInvestment(id: string) { this.update((d) => ({ ...d, investments: (d.investments ?? []).filter((x) => x.id !== id) })); }
  upsertInvestmentGoal(g: Parameters<Repo["upsertInvestmentGoal"]>[0]) { return this.upsert("investmentGoals", g) as ReturnType<Repo["upsertInvestmentGoal"]>; }
  async deleteInvestmentGoal(id: string) { this.update((d) => ({ ...d, investmentGoals: (d.investmentGoals ?? []).filter((x) => x.id !== id) })); }
  upsertDebt(x: Parameters<Repo["upsertDebt"]>[0]) {
    const old = (this.snapshot()?.debts ?? []).find((d) => d.id === x.id);
    return this.upsert("debts", { ...x, createdAt: old?.createdAt ?? new Date().toISOString() }) as ReturnType<Repo["upsertDebt"]>;
  }
  upsertReminder(r: Parameters<Repo["upsertReminder"]>[0]) { return this.upsert("reminders", r) as ReturnType<Repo["upsertReminder"]>; }
  async deleteReminder(id: string) { this.update((d) => ({ ...d, reminders: (d.reminders ?? []).filter((x) => x.id !== id) })); }
  async deleteDebt(id: string) { this.update((d) => ({ ...d, debts: (d.debts ?? []).filter((x) => x.id !== id) })); }
  async deleteRecurring(id: string) {
    this.update((d) => ({
      ...d, recurring: (d.recurring ?? []).filter((r) => r.id !== id),
      transactions: d.transactions.map((t) => (t.recurringId === id ? { ...t, recurringId: null } : t)),
    }));
  }
}
