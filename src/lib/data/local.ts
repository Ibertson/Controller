"use client";

import { buildTransactions } from "../transactions";
import type { Snapshot, Transaction } from "../types";
import type { Repo, SignInResult } from "./repo";
import { emptySnapshot } from "./seed";

const KEY = "sobra:v1";
const newId = () => crypto.randomUUID();

interface Stored { session: { name: string } | null; data: Snapshot | null; keys: string[] }

/** Guarda tudo no navegador. Serve para usar já, sem servidor; dados ficam só neste aparelho. */
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
    this.commit({ ...this.state, session: { name: name.trim() }, data: this.state.data ?? emptySnapshot(newId) });
    return "signed_in";
  }
  loadError() { return null; }
  retry() {}
  async signOut() { this.commit({ ...this.state, session: null }); }
  async renameSelf(name: string) { this.load(); this.commit({ ...this.state, session: { name } }); }

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
    this.update((d) => {
      const t = d.transactions.find((x) => x.id === id);
      if (!t) return d;
      const drop = (x: Transaction) =>
        x.id === id ||
        (scope !== "one" && !!t.installmentGroupId && x.installmentGroupId === t.installmentGroupId &&
          (scope === "all" || (x.installmentNumber ?? 0) >= (t.installmentNumber ?? 0)));
      return { ...d, transactions: d.transactions.filter((x) => !drop(x)) };
    });
  }

  async markPaid(id: string, accountId?: string) {
    this.update((d) => ({
      ...d,
      transactions: d.transactions.map((t) => (t.id === id ? { ...t, isPaid: true, dueOn: null, accountId: accountId ?? t.accountId } : t)),
    }));
  }

  private upsert<K extends "accounts" | "cards" | "categories" | "people">(key: K, item: { id?: string }) {
    let saved!: Snapshot[K][number];
    this.update((d) => {
      const id = item.id ?? newId();
      saved = { ...item, id, workspaceId: d.workspace.id } as Snapshot[K][number];
      const list = d[key] as Snapshot[K][number][];
      const exists = list.some((x) => x.id === id);
      return { ...d, [key]: exists ? list.map((x) => (x.id === id ? saved : x)) : [...list, saved] };
    });
    return Promise.resolve(saved);
  }
  upsertAccount(a: Parameters<Repo["upsertAccount"]>[0]) { return this.upsert("accounts", a) as ReturnType<Repo["upsertAccount"]>; }
  upsertCard(c: Parameters<Repo["upsertCard"]>[0]) { return this.upsert("cards", c) as ReturnType<Repo["upsertCard"]>; }
  upsertCategory(c: Parameters<Repo["upsertCategory"]>[0]) { return this.upsert("categories", c) as ReturnType<Repo["upsertCategory"]>; }
  upsertPerson(p: Parameters<Repo["upsertPerson"]>[0]) { return this.upsert("people", p) as ReturnType<Repo["upsertPerson"]>; }
}
