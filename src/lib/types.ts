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
  /** Lançamento de um gasto fixo ou receita fixa. */
  recurringId?: ID | null;
}

/** Gasto fixo ou receita fixa: o mesmo valor todo mês, no mesmo dia. */
export interface Recurring {
  id: ID; workspaceId: ID; kind: "expense" | "income"; description: string; amountCents: number;
  /** Dia do mês (1 a 31; em meses mais curtos vale o último dia). */
  day: number;
  categoryId: ID | null; accountId: ID | null; personId: ID | null;
  /** Primeiro mês em que vale ("AAAA-MM-01"). */
  startMonth: string; active: boolean;
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
  recurringId?: ID | null;
}

export type GoalCategory = "viagem" | "tecnologia" | "educacao" | "saude" | "casa" | "veiculo" | "investimento" | "outro";

/** Meta de economia. O valor guardado é a soma dos aportes (GoalContribution). */
export interface Goal {
  id: ID; workspaceId: ID; name: string; description: string; targetCents: number;
  targetDate: string | null; status: "active" | "done" | "archived";
  category: GoalCategory; personId: ID | null; color: string | null;
  /** "preset:<chave>" (imagem pronta) ou data URL de uma foto enviada; null = só a cor. */
  image: string | null; imagePosition: "top" | "center" | "bottom";
  createdAt: string; completedAt: string | null;
}

/** Valor guardado numa meta; negativo = resgate. */
export interface GoalContribution { id: ID; goalId: ID; workspaceId: ID; amountCents: number; contributedOn: string; personId: ID | null; }

export type InvestmentType = "tesouro" | "cdb" | "acoes" | "fundos" | "outros";

/** Uma aplicação. Sem valor atual, vale o aplicado. */
export interface Investment {
  id: ID; workspaceId: ID; name: string; type: InvestmentType; institution: string;
  investedCents: number; currentCents: number | null; incomeCents: number;
  /** Taxa de rendimento informada, em % (ex.: 10.5). */
  rate: number | null;
  boughtOn: string; maturityOn: string | null; notes: string;
}

/** Meta de investimento; assetType null = todos os tipos. */
export interface InvestmentGoal {
  id: ID; workspaceId: ID; name: string; targetCents: number; assetType: InvestmentType | null;
  deadline: string | null; description: string;
}

export type DebtType = "financiamento" | "emprestimo" | "informal" | "consorcio" | "cartao" | "outro";
export interface DebtExtraCost { name: string; amountCents: number; frequency: "unico" | "mensal" | "anual"; }

/** Dívida parcelada. Quitada quando as parcelas pagas chegam ao total. */
export interface Debt {
  id: ID; workspaceId: ID; name: string; creditor: string; type: DebtType;
  totalCents: number; installmentCents: number; installmentsTotal: number; installmentsPaid: number;
  /** Data de início; a 1ª parcela vence no dia de vencimento a partir dela. */
  startOn: string; dueDay: number;
  /** Juros ao mês, em %. */
  interestRate: number | null;
  category: string | null; personId: ID | null;
  /** O titular da conta é o responsável (personId fica null). */
  selfResponsible: boolean;
  /** Detalhes do financiamento (vazios nos outros tipos). */
  assetDescription: string; commissionCents: number; commissionPct: number | null; seller: string;
  assetFinalCents: number | null; monthsToReady: number | null; extraCosts: DebtExtraCost[];
  notes: string; createdAt: string;
}

export type ReminderType = "casa" | "reforma" | "manutencao" | "carro" | "moto" | "outro";

/** Lembrete com data; com repetição, concluir avança a data. */
export interface Reminder {
  id: ID; workspaceId: ID; title: string; type: ReminderType; dueOn: string;
  /** 0 = não repete. */
  repeatDays: 0 | 30 | 90 | 180 | 365;
  /** null = conta principal. */
  personId: ID | null; notes: string;
  /** Número (só dígitos, com DDI) para enviar pelo WhatsApp; null = escolher o contato no WhatsApp. */
  whatsapp: string | null;
  doneAt: string | null; lastDoneOn: string | null;
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
  /** Gastos fixos e receitas fixas (ausente em dados antigos). */
  recurring?: Recurring[];
  /** Metas e aportes (ausentes em dados antigos). */
  goals?: Goal[];
  goalContributions?: GoalContribution[];
  /** Investimentos e metas de investimento (ausentes em dados antigos). */
  investments?: Investment[];
  investmentGoals?: InvestmentGoal[];
  /** Dívidas parceladas (ausentes em dados antigos). */
  debts?: Debt[];
  reminders?: Reminder[];
}
