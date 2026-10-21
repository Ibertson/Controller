import type { Account, Card, Category, NewTransactionInput, Person, Snapshot, Transaction } from "../types";

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
  deleteTransaction(id: string, scope: "one" | "future" | "all"): Promise<void>;
  markPaid(id: string, accountId?: string): Promise<void>;

  upsertAccount(a: Omit<Account, "workspaceId" | "id"> & { id?: string }): Promise<Account>;
  upsertCard(c: Omit<Card, "workspaceId" | "id"> & { id?: string }): Promise<Card>;
  upsertCategory(c: Omit<Category, "workspaceId" | "id"> & { id?: string }): Promise<Category>;
  upsertPerson(p: Omit<Person, "workspaceId" | "id"> & { id?: string }): Promise<Person>;
}
