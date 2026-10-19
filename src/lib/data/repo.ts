import type { Account, Card, Category, NewTransactionInput, Person, Snapshot, Transaction } from "../types";

/**
 * Camada de dados. A Fase 1 começa com LocalRepo (navegador) e troca por SupabaseRepo
 * com as mesmas assinaturas, sem mexer nas telas.
 */
export interface Repo {
  /** Usuário atual; null = precisa entrar. */
  session(): { name: string } | null;
  signIn(name: string): Promise<void>;
  signOut(): Promise<void>;

  snapshot(): Snapshot | null;
  subscribe(listener: () => void): () => void;

  createTransaction(input: NewTransactionInput): Promise<Transaction[]>;
  deleteTransaction(id: string, scope: "one" | "future" | "all"): Promise<void>;
  markPaid(id: string, accountId?: string): Promise<void>;

  upsertAccount(a: Omit<Account, "workspaceId" | "id"> & { id?: string }): Promise<Account>;
  upsertCard(c: Omit<Card, "workspaceId" | "id"> & { id?: string }): Promise<Card>;
  upsertCategory(c: Omit<Category, "workspaceId" | "id"> & { id?: string }): Promise<Category>;
  upsertPerson(p: Omit<Person, "workspaceId" | "id"> & { id?: string }): Promise<Person>;
}
