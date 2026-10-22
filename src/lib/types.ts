// Espelha replica/schema.sql (Fase 1). Valores em centavos, datas "AAAA-MM-DD".

export type ID = string;

export type AccountKind = "checking" | "savings" | "wallet" | "other";
/** "both": aparece em despesas e em receitas. */
export type CategoryKind = "expense" | "income" | "both";
export type TransactionKind = "expense" | "income" | "transfer" | "card_payment";

export interface Workspace { id: ID; name: string; currency: "BRL"; }

export interface Account {
  id: ID; workspaceId: ID; name: string; kind: AccountKind;
  initialBalanceCents: number; archived: boolean;
}

export interface Card {
  id: ID; workspaceId: ID; name: string; limitCents: number;
  closingDay: number; dueDay: number; paymentAccountId: ID | null; archived: boolean;
  /** Campos visuais (opcionais: cartões antigos não têm). */
  bank?: string | null; last4?: string | null; brand?: string | null; color?: string | null; personId?: ID | null;
}

export interface Category {
  id: ID; workspaceId: ID; name: string; icon: string; kind: CategoryKind;
  /** Despesa: limite de gastos do mês. Receita: meta de receita do mês. */
  monthlyLimitCents: number | null; archived: boolean;
  /** Cor do ícone (hex); ausente = cor padrão do app. */
  color?: string | null;
  /** Subcategoria: id da categoria pai (herda o tipo dela). */
  parentId?: string | null;
}

export interface Person { id: ID; workspaceId: ID; name: string; monthlyLimitCents: number | null; archived: boolean; }

export interface Transaction {
  id: ID; workspaceId: ID; kind: TransactionKind; amountCents: number;
  occurredOn: string; description: string;
  categoryId: ID | null; accountId: ID | null; toAccountId: ID | null;
  cardId: ID | null; statementMonth: string | null; personId: ID | null;
  installmentGroupId: ID | null; installmentNumber: number | null; installmentTotal: number | null;
  isPaid: boolean; dueOn: string | null;
  source: "app" | "whatsapp_text" | "whatsapp_audio" | "whatsapp_photo" | "import";
  createdAt: string;
  /** Na lixeira desde esta data; ausente = ativo. */
  deletedAt?: string | null;
}

/** Entrada do formulário "Novo lançamento". Parcelado gera várias Transaction. */
export interface NewTransactionInput {
  kind: TransactionKind;
  amountCents: number;          // total; parcelado divide
  occurredOn: string;
  description: string;
  categoryId?: ID | null;
  accountId?: ID | null;
  toAccountId?: ID | null;
  cardId?: ID | null;
  personId?: ID | null;
  installments?: number;        // 1 = à vista
  statementMonth?: string;      // só para card_payment: qual fatura está sendo paga
  isPaid?: boolean;
  dueOn?: string | null;
  idempotencyKey?: string;
  /** De onde veio; padrão "app". */
  source?: Transaction["source"];
}

export interface Snapshot {
  workspace: Workspace;
  accounts: Account[];
  cards: Card[];
  categories: Category[];
  people: Person[];
  transactions: Transaction[];
  /** Lançamentos excluídos, que podem ser restaurados (fora de todos os totais). */
  trash?: Transaction[];
}
