import { describe, expect, it } from "vitest";
import { DEFAULT_EXPENSE, DEFAULT_INCOME, defaultCategoryChanges } from "./categories";
import { bulkPayments, bulkTransactions, defaultBulkRange } from "./bulk";
import { dropForever, expiredTrash, freshSnapshot, moveFromTrash, moveToTrash, scopeIds } from "./data/repo";
import { emptySnapshot } from "./data/seed";
import { emptyFilters, filterStatement, statementTotals, type ExtratoFilters } from "./extrato";
import { filterForExport } from "./report";
import { parseAmount, parseCsv, parseDate, parseOfx, rowsFromTable } from "./statement";
import type { Snapshot, Transaction } from "./types";
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
