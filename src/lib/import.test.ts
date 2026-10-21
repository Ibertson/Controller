import { describe, expect, it } from "vitest";
import { dropForever, moveFromTrash, moveToTrash, scopeIds } from "./data/repo";
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
