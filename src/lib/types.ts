// Espelha replica/schema.sql (Fase 1). Valores em centavos, datas "AAAA-MM-DD".

export type ID = string;

export type AccountKind = "checking" | "savings" | "wallet" | "other";
/** "both": aparece em despesas e em receitas. */
export type CategoryKind = "expense" | "income" | "both";
export type TransactionKind = "expense" | "income" | "transfer" | "card_payment";

export type WorkspaceKind = "personal" | "business";
/** Tipo/regime da empresa. ltda, slu, sa e autonomo vêm do primeiro cadastro e continuam valendo. */
export type CompanyType = "mei" | "me" | "me_simples" | "epp" | "epp_simples" | "presumido" | "real" | "outro"
  | "ltda" | "slu" | "sa" | "autonomo";
/** Dados complementares da empresa (Configurações). Tudo opcional. */
export interface CompanyDetails {
  /** Razão social (o nome da empresa é o nome fantasia). */
  legalName?: string; email?: string; city?: string; uf?: string;
  /** CNAE principal, só dígitos (7). */
  cnae?: string;
  /** Data de abertura (YYYY-MM-DD). */
  openedOn?: string;
  /** MEI: valor do DAS mensal. */
  dasCents?: number;
  pushAlerts?: boolean; monthlyReport?: boolean;
  /** Link da prefeitura para emitir nota fiscal. */
  nfseUrl?: string;
  publicCatalog?: boolean;
  /** Categorias dos produtos (cadastro de Produtos). */
  productCategories?: string[];
  /** Categorias de serviço criadas pela empresa (além das fixas). */
  serviceCategories?: string[];
  /** Tipos de serviço da janela "Novo orçamento"; ausente = o catálogo sugerido. */
  quoteCatalog?: QuoteCategory[];
}
/** Dados da empresa (espaço empresarial). */
export interface Company { name: string; cnpj: string | null; activity: string; companyType: CompanyType; details?: CompanyDetails }
/** Espaço de dados: o pessoal e, se cadastrada, o da empresa. kind ausente = pessoal (dados antigos). */
/** Produto do catálogo da empresa. Preços em centavos. */
export interface Product {
  id: ID; name: string; category: string; description: string;
  /** Código interno ou de barras. */
  sku: string; unit: string;
  costCents: number; priceCents: number;
  stock: number; minStock: number;
  /** Foto já reduzida no navegador (data URL). */
  photo: string | null;
  active: boolean;
  /** Validade mais próxima entre os lotes em estoque (vem das entradas). */
  expiresOn?: string | null;
  createdAt: string;
}
/** Entrada ou saída de estoque de um produto. */
export interface StockMovement {
  id: ID; productId: string; productName: string; kind: "in" | "out"; qty: number;
  /** Custo unitário na hora da movimentação (entrada: o da compra; saída: o custo médio). */
  unitCostCents: number | null;
  note: string; expiresOn: string | null; occurredOn: string; createdAt: string;
}
export type ExpenseType = "despesa" | "compra" | "folha";
/** Dados extras de uma despesa da empresa (o valor, a data e a conta ficam no lançamento). */
export interface ExpenseDetail {
  transactionId: ID; type: ExpenseType; supplier: string; employee: string;
  /** Parcelas de boleto/conta (não cartão): mesmo grupo, número e total. */
  groupId: string | null; installment: number | null; installments: number | null;
  /** Forma de pagamento (pix, dinheiro, debito, credito, boleto, transferencia); vazio nos antigos. */
  paymentMethod?: string;
  /** Histórico: NF, competência, contrato. */
  notes?: string;
  /** Comprovante no armazenamento (bucket receipts) ou, no modo local, data URL. */
  receiptPath?: string | null;
}
export type ClientKind = "eventual" | "recorrente";
/** Cliente da empresa (aba Clientes & Recebíveis). */
export interface BusinessClient {
  id: ID; name: string; phone: string; kind: ClientKind; notes: string;
  /** Na lixeira desde (ISO); null = ativo. */
  deletedAt: string | null; createdAt: string;
}
/** Conta a receber; parcelas da mesma venda dividem o groupId. */
export interface Receivable {
  id: ID; groupId: string; description: string; amountCents: number; dueOn: string;
  clientId: string | null;
  installment: number; installments: number;
  /** Data em que foi recebida; null = em aberto. */
  receivedOn: string | null;
  /** Receita lançada ao marcar como recebida. */
  transactionId: string | null;
  deletedAt: string | null; createdAt: string;
}
export type ActivityStatus = "todo" | "doing" | "waiting" | "done";
/** Atividade da agenda da empresa (quadro A Fazer → Concluído). */
export interface Activity {
  id: ID; clientName: string;
  /** Serviço cadastrado usado como base (opcional). */
  serviceId: string | null;
  title: string; valueCents: number;
  /** Data de vencimento (entrega ou cobrança). */
  dueOn: string;
  notes: string; status: ActivityStatus; createdAt: string;
}
export interface Service {
  id: ID; name: string; category: string; description: string;
  /** Valor padrão cobrado. */
  priceCents: number;
  /** Duração em horas (aceita fração: 2.5). */
  hours: number;
  active: boolean;
  createdAt: string;
}
/** Categoria de serviço do orçamento com as subcategorias (editáveis pela empresa). */
export interface QuoteCategory { id: string; name: string; icon: string; items: string[] }
export type QuoteStatus = "enviado" | "visualizado" | "aprovado" | "andamento" | "concluido" | "recusado";
export type QuoteKind = "produtos" | "servico" | "personalizado";
export interface QuoteItem { id: string; description: string; qty: number; unitCents: number; productId?: string | null; serviceId?: string | null }
/** Dados da empresa copiados no orçamento (aparecem no link do cliente). */
export interface QuoteCompany { name: string; cnpj: string | null; email: string; city: string; uf: string }
export interface Quote {
  id: ID;
  /** Número sequencial da empresa (ORC-0001). */
  number: number;
  kind: QuoteKind; category: string; title: string;
  clientName: string; clientPhone: string; clientEmail: string;
  issuedOn: string; validUntil: string;
  status: QuoteStatus;
  items: QuoteItem[];
  discountCents: number;
  notes: string;
  /** Código do link público do orçamento. */
  token: string;
  viewedAt: string | null;
  company: QuoteCompany;
  createdAt: string;
}
export interface Workspace {
  id: ID; name: string; currency: "BRL"; kind?: WorkspaceKind;
  cnpj?: string | null; activity?: string; companyType?: CompanyType | null; details?: CompanyDetails;
}
export interface WorkspaceRef { id: ID; kind: WorkspaceKind; name: string }

export interface Account {
  id: ID; workspaceId: ID; name: string; kind: AccountKind;
  initialBalanceCents: number; archived: boolean;
  /** Detalhes da conta (opcionais: contas antigas não têm). */
  bank?: string | null;
  /** Etiqueta para diferenciar contas do mesmo banco. */
  label?: string | null;
  /** Dono da conta; null = o titular. */
  personId?: ID | null;
  /** Limite do cheque especial; null = não possui. */
  overdraftCents?: number | null;
  /** Cartão de débito: null = não possui. */
  debitLast4?: string | null; debitBrand?: string | null; hasDebit?: boolean;
  /** Cor da conta (chave das cores do app). */
  color?: string | null;
  /** Subconta (poupança ou caixinha) ligada a esta conta. */
  parentId?: ID | null; subKind?: "poupanca" | "caixinha" | null;
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
  /** Todos os espaços de quem está conectado (pessoal e empresa). */
  workspaces?: WorkspaceRef[];
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

/** Número de WhatsApp ligado ao perfil (o titular ou uma pessoa cadastrada). */
export interface WhatsappNumber { name: string; personId: ID | null; phone: string; primary: boolean; }

/** Dados de quem está conectado (não fazem parte do espaço de dados). */
export interface Profile {
  email: string | null;
  /** "YYYY-MM-DD" do cadastro. */
  memberSince: string;
  /** Já criou senha (no modo online o acesso padrão é por link no email). */
  hasPassword: boolean;
  phone: string; location: string;
  /** Foto como data URL; null = iniciais. */
  avatar: string | null;
  whatsapp: WhatsappNumber[];
}
