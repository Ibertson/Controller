import { describe, expect, it } from "vitest";
import { CATEGORY_ICONS, DEFAULT_EXPENSE, DEFAULT_INCOME, categoryFits, categoryOptions, defaultCategoryChanges, inkOn, subcategoriesOf } from "./categories";
import { bulkPayments, bulkTransactions, defaultBulkRange } from "./bulk";
import { dropForever, expiredTrash, freshSnapshot, moveFromTrash, moveToTrash, scopeIds } from "./data/repo";
import { emptySnapshot } from "./data/seed";
import { emptyFilters, filterStatement, statementTotals, type ExtratoFilters } from "./extrato";
import { agendaEvents, monthClosing, pendingTotals, recurringDate } from "./previsao";
import { goalSummary, monthlyNeeded, savedByGoal } from "./goals";
import { debtSummary, extraCostTotals, installmentDue, isPaidOff, nextDue } from "./debts";
import { addDays, completeReminder, dueStatus } from "./reminders";
import { distributionByType, evolutionMonths, goalProgress, investedByMonth, investmentTotals, matchesSearch, returnPct } from "./investments";
import { filterForExport } from "./report";
import { parseAmount, parseCsv, parseDate, parseOfx, rowsFromTable } from "./statement";
import type { Category, Debt, Reminder, Goal, Investment, Snapshot, Transaction } from "./types";
import { unzip, writeXlsx } from "./xlsx";

describe("extrato", () => {
  it("lê valores em vários formatos", () => {
    expect(parseAmount("-1.234,56")).toBe(-123456);
    expect(parseAmount("1234.5")).toBe(123450);
    expect(parseAmount("R$ 10,00")).toBe(1000);
    expect(parseAmount("(10,00)")).toBe(-1000);
    expect(parseAmount("25,90 D")).toBe(-2590);
    expect(parseAmount("1.000")).toBe(100000);
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount(-12.3)).toBe(-1230);
  });
  it("lê datas", () => {
    expect(parseDate("05/10/2026")).toBe("2026-10-05");
    expect(parseDate("2026-10-05")).toBe("2026-10-05");
    expect(parseDate("20261005")).toBe("2026-10-05");
    expect(parseDate(46300)).toBe("2026-10-05");
    expect(parseDate("31/13/2026")).toBeNull();
  });
  it("lê OFX", () => {
    const ofx = `<OFX><BANKTRANLIST><STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261005120000[-3:BRT]<TRNAMT>-52.30<FITID>1<MEMO>Padaria
</STMTTRN><STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261006<TRNAMT>1500.00<FITID>2<NAME>Salario</STMTTRN></BANKTRANLIST></OFX>`;
    expect(parseOfx(ofx)).toEqual([
      { date: "2026-10-05", description: "Padaria", amountCents: -5230, id: "1" },
      { date: "2026-10-06", description: "Salario", amountCents: 150000, id: "2" },
    ]);
  });
  it("lê CSV com cabeçalho e ignora saldo", () => {
    const csv = "Extrato conta\nData;Histórico;Valor\n05/10/2026;Mercado;-120,50\n06/10/2026;\"Pix, recebido\";300,00\n06/10/2026;Saldo do dia;179,50";
    expect(rowsFromTable(parseCsv(csv))).toEqual([
      { date: "2026-10-05", description: "Mercado", amountCents: -12050 },
      { date: "2026-10-06", description: "Pix, recebido", amountCents: 30000 },
    ]);
  });
  it("lê CSV com crédito e débito separados", () => {
    const csv = "data,descricao,credito,debito\n2026-10-01,Luz,,89.90\n2026-10-02,Venda,50.00,";
    expect(rowsFromTable(parseCsv(csv)).map((r) => r.amountCents)).toEqual([-8990, 5000]);
  });
});

describe("xlsx", () => {
  it("gera um zip com as abas", async () => {
    const blob = writeXlsx([{ name: "Lançamentos", rows: [["Data", "Valor"], ["05/10/2026", -12.5]], money: [1] }]);
    const files = await unzip(await blob.arrayBuffer(), () => true);
    expect([...files.keys()]).toContain("xl/worksheets/sheet1.xml");
    const sheet = new TextDecoder().decode(files.get("xl/worksheets/sheet1.xml"));
    expect(sheet).toContain("<v>-12.5</v>");
    expect(sheet).toContain("Data");
  });
});

const tx = (o: Partial<Transaction>): Transaction => ({
  id: "x", workspaceId: "w", kind: "expense", amountCents: 100, occurredOn: "2026-10-05", description: "", categoryId: null,
  accountId: "a", toAccountId: null, cardId: null, statementMonth: null, personId: null, installmentGroupId: null,
  installmentNumber: null, installmentTotal: null, isPaid: true, dueOn: null, source: "app", createdAt: "", ...o,
});
const snap = (transactions: Transaction[]): Snapshot => ({
  workspace: { id: "w", name: "P", currency: "BRL" }, accounts: [], cards: [], categories: [], people: [], transactions,
});

describe("lixeira", () => {
  const list = [tx({ id: "1", installmentGroupId: "g", installmentNumber: 1 }), tx({ id: "2", installmentGroupId: "g", installmentNumber: 2 }), tx({ id: "3" })];
  it("escopo das parcelas", () => {
    expect(scopeIds(list, "2", "one")).toEqual(["2"]);
    expect(scopeIds(list, "1", "future")).toEqual(["1", "2"]);
    expect(scopeIds(list, "2", "all")).toEqual(["1", "2"]);
  });
  it("move, restaura e apaga", () => {
    let s = moveToTrash(snap(list), ["1", "3"], "2026-10-21T00:00:00Z");
    expect(s.transactions.map((t) => t.id)).toEqual(["2"]);
    expect(s.trash!.map((t) => t.deletedAt)).toEqual(["2026-10-21T00:00:00Z", "2026-10-21T00:00:00Z"]);
    s = moveFromTrash(s, ["3"]);
    expect(s.transactions.map((t) => t.id).sort()).toEqual(["2", "3"]);
    s = dropForever(s, ["1"]);
    expect(s.trash).toEqual([]);
  });
});

describe("exportar", () => {
  const s = snap([tx({ id: "1", occurredOn: "2026-09-10" }), tx({ id: "2", kind: "income", personId: "p" }), tx({ id: "3" })]);
  it("filtra período, tipo e pessoa", () => {
    expect(filterForExport(s, { period: "month", month: "2026-10-01", kind: "all", people: [] }).map((t) => t.id)).toEqual(["2", "3"]);
    expect(filterForExport(s, { period: "last3", month: "2026-10-01", kind: "expense", people: [] }).map((t) => t.id)).toEqual(["1", "3"]);
    expect(filterForExport(s, { period: "all", month: "2026-10-01", kind: "all", people: [""] }).map((t) => t.id)).toEqual(["1", "3"]);
  });
});

describe("categorias padrão", () => {
  const cat = (name: string, kind: "expense" | "income" = "expense") =>
    ({ id: name, workspaceId: "w", name, icon: "", kind, monthlyLimitCents: null, archived: false });
  it("renomeia as antigas e cria só as que faltam", () => {
    const changes = defaultCategoryChanges([cat("Restaurantes"), cat("MERCADO"), cat("Extra", "income"), cat("Restaurante")]);
    const names = changes.map((c) => c.name);
    expect(changes.find((c) => c.id === "Extra")?.name).toBe("Freelance/Extra");
    expect(changes.some((c) => c.id === "Restaurantes")).toBe(false); // "Restaurante" já existe
    expect(names).not.toContain("Mercado");
    expect(names).toContain("Pet");
    expect(names.filter((n) => n === "Freelance/Extra")).toHaveLength(1);
  });
  it("não muda nada quando já está tudo lá", () => {
    const all = [...DEFAULT_EXPENSE.map(([n]) => cat(n)), ...DEFAULT_INCOME.map(([n]) => cat(n, "income"))];
    expect(defaultCategoryChanges(all)).toEqual([]);
  });
});

describe("tela de extrato", () => {
  const base = emptySnapshot(() => Math.random().toString(36).slice(2));
  const acc = base.accounts[0].id;
  const tx = (o: Partial<Transaction>): Transaction => ({
    id: Math.random().toString(36).slice(2), workspaceId: "w", kind: "expense", amountCents: 1000, occurredOn: "2026-10-05", description: "x",
    categoryId: null, accountId: acc, toAccountId: null, cardId: null, personId: null, isPaid: true, statementMonth: null,
    installmentGroupId: null, installmentNumber: null, installmentTotal: null, createdAt: "2026-10-05T00:00:00Z", ...o,
  } as Transaction);
  const snap = { ...base, cards: [], transactions: [
    tx({ description: "Mercado Bom Preço", amountCents: 5000 }),
    tx({ kind: "income", description: "Salário", amountCents: 300000 }),
    tx({ description: "Compra no cartão", cardId: "c1", accountId: null }),
    tx({ kind: "transfer", toAccountId: "a2", description: "Para poupança" }),
    tx({ occurredOn: "2026-11-02", description: "Fora do período" }),
  ] };
  const f = (o: Partial<ExtratoFilters>) => ({ ...emptyFilters("2026-10-01", "2026-10-31"), ...o });
  it("filtra por período, aba, busca, tipo e valor", () => {
    expect(filterStatement(snap, f({}))).toHaveLength(4);
    expect(filterStatement(snap, f({ from: "", to: "" }))).toHaveLength(5);
    expect(filterStatement(snap, f({ tab: "cartao" })).map((t) => t.description)).toEqual(["Compra no cartão"]);
    expect(filterStatement(snap, f({ search: "mercado bom" }))).toHaveLength(1);
    expect(filterStatement(snap, f({ kind: "transfer" })).map((t) => t.description)).toEqual(["Para poupança"]);
    expect(filterStatement(snap, f({ minCents: 2000, maxCents: 10000 })).map((t) => t.description)).toEqual(["Mercado Bom Preço"]);
    expect(filterStatement(snap, f({ sourceId: "a2" }))).toHaveLength(1);
    expect(statementTotals(filterStatement(snap, f({})))).toEqual({ income: 300000, expense: 6000, net: 294000 });
  });
});

describe("excluir em massa e resetar", () => {
  const base = emptySnapshot(() => Math.random().toString(36).slice(2));
  const acc = base.accounts[0].id;
  const tx = (o: Partial<Transaction>): Transaction => ({
    id: Math.random().toString(36).slice(2), workspaceId: base.workspace.id, kind: "expense", amountCents: 1000, occurredOn: "2026-10-05", description: "x",
    categoryId: null, accountId: acc, toAccountId: null, cardId: null, personId: null, isPaid: true, statementMonth: null, dueOn: null, source: "app",
    installmentGroupId: null, installmentNumber: null, installmentTotal: null, createdAt: "2026-10-05T00:00:00Z", ...o,
  });
  const snap = { ...base, transactions: [
    tx({ kind: "income", description: "Salário" }), tx({ description: "Mercado" }),
    tx({ description: "Jantar", cardId: "c1", accountId: null }), tx({ kind: "card_payment", description: "Fatura", statementMonth: "2026-10-01" }),
    tx({ description: "Antigo", occurredOn: "2019-05-01" }),
  ] };
  const r = { ...defaultBulkRange("2026-10-21"), search: "" };
  it("período padrão vai de 2020 até o fim do mês", () => expect(r).toMatchObject({ from: "2020-01-01", to: "2026-10-31" }));
  it("separa transações e pagamentos de fatura", () => {
    const d = (l: Transaction[]) => l.map((t) => t.description).sort();
    expect(d(bulkTransactions(snap, { ...r, filter: "all" }))).toEqual(["Jantar", "Mercado", "Salário"]);
    expect(d(bulkTransactions(snap, { ...r, filter: "expense" }))).toEqual(["Mercado"]);
    expect(d(bulkTransactions(snap, { ...r, filter: "card" }))).toEqual(["Jantar"]);
    expect(d(bulkTransactions(snap, { ...r, search: "sala", filter: "all" }))).toEqual(["Salário"]);
    expect(d(bulkPayments(snap, { ...r, filter: "all" }))).toEqual(["Fatura"]);
    expect(bulkPayments(snap, { ...r, filter: "fixed_expense" })).toEqual([]);
  });
  it("resetar recomeça com conta e categorias padrão no mesmo espaço", () => {
    const f = freshSnapshot(snap.workspace, () => Math.random().toString(36).slice(2));
    expect(f.workspace.id).toBe(snap.workspace.id);
    expect(f.transactions).toEqual([]);
    expect(f.accounts).toHaveLength(1);
    expect(f.categories.every((c) => c.workspaceId === snap.workspace.id)).toBe(true);
  });
  it("lixeira expira em 30 dias", () => {
    const trash = [tx({ id: "velho", deletedAt: "2026-09-01T00:00:00Z" }), tx({ id: "novo", deletedAt: "2026-10-20T00:00:00Z" })];
    expect(expiredTrash(trash, new Date("2026-10-21T12:00:00Z"))).toEqual(["velho"]);
  });
});

describe("nova categoria", () => {
  it("Ambos aparece em despesas e receitas", () => {
    expect(categoryFits({ kind: "both" }, "expense")).toBe(true);
    expect(categoryFits({ kind: "both" }, "income")).toBe(true);
    expect(categoryFits({ kind: "income" }, "expense")).toBe(false);
  });
  it("tem 48 ícones sem repetir e cor de texto legível", () => {
    expect(new Set(CATEGORY_ICONS.map(([k]) => k)).size).toBe(48);
    expect(inkOn("#222222")).toBe("#ffffff");
    expect(inkOn("#e6df2c")).toBe("#121a17");
  });
});

describe("subcategorias", () => {
  const base = { workspaceId: "w", icon: "", monthlyLimitCents: null, archived: false };
  const cats: Category[] = [
    { ...base, id: "a", name: "Alimentação", kind: "expense" },
    { ...base, id: "a1", name: "Delivery", kind: "expense", parentId: "a" },
    { ...base, id: "a2", name: "Café", kind: "expense", parentId: "a" },
    { ...base, id: "s", name: "Salário", kind: "income" },
    { ...base, id: "x", name: "Velha", kind: "expense", archived: true },
  ];
  it("lista o pai seguido das subcategorias, em ordem", () => {
    expect(subcategoriesOf(cats, "a").map((c) => c.name)).toEqual(["Café", "Delivery"]);
    expect(categoryOptions(cats, "expense").map((o) => o.label)).toEqual(["Alimentação", "Alimentação › Café", "Alimentação › Delivery"]);
    expect(categoryOptions(cats).map((o) => o.label)).toContain("Salário");
  });
  it("filtrar o extrato pelo pai inclui as subcategorias", () => {
    const tx = (id: string, categoryId: string) => ({ id, workspaceId: "w", kind: "expense" as const, amountCents: 100, occurredOn: "2026-10-05", description: id, categoryId, accountId: null, toAccountId: null, cardId: null, statementMonth: null, personId: null, createdAt: "2026-10-05T00:00:00Z" });
    const snap = { categories: cats, transactions: [tx("t1", "a"), tx("t2", "a1"), tx("t3", "s")] } as unknown as Snapshot;
    const f = { ...emptyFilters("2026-10-01", "2026-10-31"), categoryId: "a" };
    expect(filterStatement(snap, f).map((t) => t.id)).toEqual(["t1", "t2"]);
  });
});

describe("previsão", () => {
  const base = emptySnapshot(() => Math.random().toString(36).slice(2));
  const acc = base.accounts[0].id;
  const tx = (o: Partial<Transaction>): Transaction => ({
    id: Math.random().toString(36).slice(2), workspaceId: "w", kind: "expense", amountCents: 1000, occurredOn: "2026-10-10", description: "x",
    categoryId: null, accountId: acc, toAccountId: null, cardId: null, statementMonth: null, personId: null, installmentGroupId: null,
    installmentNumber: null, installmentTotal: null, isPaid: true, dueOn: null, source: "app", createdAt: "2026-10-01T00:00:00Z", ...o,
  });
  const fixo = { id: "r1", workspaceId: "w", kind: "expense" as const, description: "Aluguel", amountCents: 150000, day: 31, categoryId: null, accountId: acc, personId: null, startMonth: "2026-09-01", active: true };
  const salario = { ...fixo, id: "r2", kind: "income" as const, description: "Salário", amountCents: 500000, day: 5 };
  const s: Snapshot = { ...base, recurring: [fixo, salario], transactions: [
    tx({ description: "Luz", isPaid: false, dueOn: "2026-10-15", amountCents: 20000 }),
    tx({ kind: "income", description: "Salário out", recurringId: "r2", occurredOn: "2026-10-05", amountCents: 500000 }),
    tx({ description: "Mercado", amountCents: 30000 }),
  ] };
  it("fixo usa o último dia em meses curtos", () => {
    expect(recurringDate(fixo, "2026-11-01")).toBe("2026-11-30");
  });
  it("agenda mostra pendentes e fixos não lançados", () => {
    const ev = agendaEvents(s, "2026-10-01");
    expect(ev.map((e) => [e.date, e.label, e.type])).toEqual([["2026-10-15", "Luz", "Despesa a pagar"], ["2026-10-31", "Aluguel", "Gasto fixo"]]);
    expect(agendaEvents(s, "2026-08-01")).toEqual([]);
  });
  it("fechamento separa avulsos e fixos", () => {
    expect(monthClosing(s, "2026-10-01")).toMatchObject({
      looseIncomeCents: 0, fixedIncomeCents: 500000, looseExpenseCents: 50000, fixedExpenseCents: 150000, resultCents: 300000,
    });
    expect(pendingTotals(s, "2026-10-01")).toMatchObject({ payCents: 170000, receiveCents: 0, payCount: 2 });
  });
  it("lançamento de fixo aparece em Pagamentos", () => {
    expect(bulkPayments(s, { from: "2026-10-01", to: "2026-10-31", search: "", filter: "fixed_income" }).map((t) => t.description)).toEqual(["Salário out"]);
  });
});

describe("metas", () => {
  const g = (o: Partial<Goal>): Goal => ({ id: "g1", workspaceId: "w", name: "Viagem", description: "", targetCents: 100000, targetDate: null, status: "active",
    category: "viagem", personId: null, color: null, image: "preset:viagem", imagePosition: "center", createdAt: "", completedAt: null, ...o });
  const c = (goalId: string, amountCents: number) => ({ id: Math.random().toString(36), goalId, workspaceId: "w", amountCents, contributedOn: "2026-10-01", personId: null });
  const s = { ...emptySnapshot(() => Math.random().toString(36).slice(2)),
    goals: [g({}), g({ id: "g2", status: "done", targetCents: 5000 }), g({ id: "g3", status: "archived" })],
    goalContributions: [c("g1", 30000), c("g1", -5000), c("g2", 5000), c("g3", 9999)] } as Snapshot;
  it("soma aportes menos resgates e separa ativas e concluídas", () => {
    expect(savedByGoal(s).get("g1")).toBe(25000);
    const sum = goalSummary(s);
    expect([sum.active.length, sum.done.length, sum.totalSavedCents]).toEqual([1, 1, 30000]);
  });
  it("calcula quanto guardar por mês até a data", () => {
    expect(monthlyNeeded({ targetCents: 100000, targetDate: "2027-02-15" }, 25000, "2026-10-22")).toBe(18750);
    expect(monthlyNeeded({ targetCents: 100000, targetDate: null }, 0, "2026-10-22")).toBeNull();
    expect(monthlyNeeded({ targetCents: 100000, targetDate: "2026-10-30" }, 0, "2026-10-22")).toBe(100000);
  });
});

describe("investimentos", () => {
  const inv = (o: Partial<Investment>): Investment => ({ id: "i1", workspaceId: "w", name: "Tesouro Selic 2029", type: "tesouro", institution: "Nubank",
    investedCents: 100000, currentCents: null, incomeCents: 0, rate: null, boughtOn: "2026-08-10", maturityOn: null, notes: "", ...o });
  const list = [inv({}), inv({ id: "i2", name: "PETR4", type: "acoes", investedCents: 50000, currentCents: 45000, incomeCents: 2000, boughtOn: "2026-10-01" }),
    inv({ id: "i3", name: "CDB Inter", type: "cdb", institution: "Inter", investedCents: 20000, currentCents: 23000, boughtOn: "2025-12-05" })];
  it("soma patrimônio, valorização e rendimento", () => {
    expect(investmentTotals(list)).toEqual({ investedCents: 170000, patrimonyCents: 168000, appreciationCents: -2000, incomeCents: 2000, returnCents: 0 });
    expect(returnPct(list[1])).toBeCloseTo(-6);
    expect(distributionByType(list).map((s) => [s.id, s.cents])).toEqual([["tesouro", 100000], ["acoes", 45000], ["cdb", 23000]]);
  });
  it("evolução acumula pelo mês da compra", () => {
    const months = evolutionMonths(list, "6m", "2026-10-01");
    expect(months).toEqual(["2026-05-01", "2026-06-01", "2026-07-01", "2026-08-01", "2026-09-01", "2026-10-01"]);
    expect(investedByMonth(list, months)).toEqual([20000, 20000, 20000, 120000, 120000, 170000]);
    expect(evolutionMonths(list, "all", "2026-10-01")[0]).toBe("2025-12-01");
    expect(evolutionMonths(list, "year", "2026-10-01")).toHaveLength(10);
    expect(evolutionMonths([], "all", "2026-10-01")).toEqual(["2026-09-01", "2026-10-01"]);
  });
  it("meta soma o tipo dela ou todos", () => {
    const g = { id: "m", workspaceId: "w", name: "Reserva", targetCents: 200000, deadline: null, description: "" };
    expect(goalProgress({ ...g, assetType: null }, list)).toBe(168000);
    expect(goalProgress({ ...g, assetType: "cdb" }, list)).toBe(23000);
  });
  it("busca ignora acento e procura na instituição", () => {
    expect(list.filter((i) => matchesSearch(i, "acoes")).map((i) => i.id)).toEqual(["i2"]);
    expect(list.filter((i) => matchesSearch(i, "inter")).map((i) => i.id)).toEqual(["i3"]);
  });
});

describe("dívidas", () => {
  const debt = (o: Partial<Debt>): Debt => ({ id: "d1", workspaceId: "w", name: "Carro", creditor: "Banco", type: "financiamento", totalCents: 1200000,
    installmentCents: 100000, installmentsTotal: 12, installmentsPaid: 3, startOn: "2026-10-22", dueDay: 10, interestRate: 1.5, category: null,
    personId: null, selfResponsible: false, assetDescription: "", commissionCents: 0, commissionPct: null, seller: "", assetFinalCents: null, monthsToReady: null,
    extraCosts: [], notes: "", createdAt: "", ...o });
  it("vence no dia escolhido a partir da data de início", () => {
    expect(installmentDue(debt({}), 1)).toBe("2026-11-10");
    expect(installmentDue(debt({ startOn: "2026-10-05" }), 1)).toBe("2026-10-10");
    expect(installmentDue(debt({ startOn: "2026-01-15", dueDay: 31 }), 2)).toBe("2026-02-28");
    expect(nextDue(debt({}))).toBe("2027-02-10");
    expect(nextDue(debt({ installmentsPaid: 12 }))).toBeNull();
  });
  it("resume só as dívidas em aberto", () => {
    const list = [debt({}), debt({ id: "d2", installmentsPaid: 12 }), debt({ id: "d3", totalCents: 50000, installmentCents: 25000, installmentsTotal: 2, installmentsPaid: 0 })];
    expect(isPaidOff(list[1])).toBe(true);
    expect(debtSummary(list)).toEqual({ totalCents: 1250000, paidCents: 300000, remainingCents: 950000, monthlyCents: 125000 });
  });
  it("soma custos extras por frequência", () => {
    expect(extraCostTotals({ extraCosts: [{ name: "IPTU", amountCents: 1000, frequency: "anual" }, { name: "Pintura", amountCents: 500, frequency: "unico" },
      { name: "Condomínio", amountCents: 300, frequency: "mensal" }, { name: "ITBI", amountCents: 200, frequency: "unico" }] }))
      .toEqual({ unico: 700, mensal: 300, anual: 1000 });
  });
});

describe("lembretes", () => {
  const r: Reminder = { id: "r", workspaceId: "w", title: "Óleo", type: "carro", dueOn: "2026-10-20", repeatDays: 90, personId: null, notes: "", doneAt: null, lastDoneOn: null };
  it("mostra a situação pela data", () => {
    expect(dueStatus("2026-10-20", "2026-10-22")).toEqual({ tone: "late", label: "Vencido há 2 dias" });
    expect(dueStatus("2026-10-22", "2026-10-22").label).toBe("Vence hoje");
    expect(dueStatus("2026-10-23", "2026-10-22").label).toBe("Amanhã");
    expect(dueStatus("2026-11-21", "2026-10-22")).toEqual({ tone: "later", label: "Em 30 dias" });
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
  it("concluir repete a partir de hoje ou encerra", () => {
    expect(completeReminder(r, "2026-10-22", "x")).toMatchObject({ dueOn: "2027-01-20", lastDoneOn: "2026-10-22", doneAt: null });
    expect(completeReminder({ ...r, repeatDays: 0 }, "2026-10-22", "x")).toMatchObject({ dueOn: "2026-10-20", doneAt: "x" });
  });
});
