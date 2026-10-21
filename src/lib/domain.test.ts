import { describe, expect, it } from "vitest";
import { formatBRL, formatSigned, parseBRL, splitInstallments } from "./money";
import { addMonthsToDay, dayLabel, monthLabel, statementMonthFor, today } from "./dates";
import { buildTransactions, ValidationError } from "./transactions";
import {
  accountBalances, accountStatement, balanceSeries, categoryUsage, forecast, totalsByPerson, incomeByAccount, monthBreakdown, monthSeries, monthTotals, projectedLeftover, totalsByCategory, upcomingBills,
} from "./summary";
import { transactionsCsv } from "./csv";
import type { Card, Snapshot } from "./types";

describe("money", () => {
  it("formata em reais", () => {
    expect(formatBRL(123456)).toBe("R$ 1.234,56");
    expect(formatSigned(1000, "expense")).toBe("− R$ 10,00");
  });
  it("lê o que a pessoa digita", () => {
    expect(parseBRL("12")).toBe(1200);
    expect(parseBRL("12,5")).toBe(1250);
    expect(parseBRL("1.234,56")).toBe(123456);
    expect(parseBRL("R$ 9,90")).toBe(990);
    expect(parseBRL("abc")).toBeNull();
    expect(parseBRL("1,234")).toBeNull();
  });
  it("põe os centavos que sobram na 1ª parcela", () => {
    expect(splitInstallments(10000, 3)).toEqual([3334, 3333, 3333]);
    expect(splitInstallments(10000, 3).reduce((a, b) => a + b)).toBe(10000);
  });
});

describe("datas", () => {
  it("compra antes do fechamento cai na fatura do mês", () => {
    expect(statementMonthFor("2026-10-04", 5)).toBe("2026-10-01");
  });
  it("compra no dia do fechamento ou depois cai na seguinte", () => {
    expect(statementMonthFor("2026-10-05", 5)).toBe("2026-11-01");
    expect(statementMonthFor("2026-12-20", 5)).toBe("2027-01-01");
  });
  it("fechamento 31 em fevereiro vira o último dia", () => {
    expect(statementMonthFor("2026-02-27", 31)).toBe("2026-02-01");
    expect(statementMonthFor("2026-02-28", 31)).toBe("2026-03-01");
  });
  it("dia 31 + 1 mês vira 30 ou 28", () => {
    expect(addMonthsToDay("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonthsToDay("2026-10-31", 1)).toBe("2026-11-30");
  });
  it("hoje respeita o fuso de São Paulo", () => {
    expect(today("America/Sao_Paulo", new Date("2026-10-20T02:00:00Z"))).toBe("2026-10-19");
  });
  it("rótulos", () => {
    expect(monthLabel("2026-10-01")).toBe("outubro 2026");
    expect(dayLabel("2026-10-19", "2026-10-19")).toBe("Hoje");
    expect(dayLabel("2026-10-18", "2026-10-19")).toBe("Ontem");
  });
});

const card: Card = { id: "c1", workspaceId: "w", name: "Cartão", limitCents: 500000, closingDay: 5, dueDay: 12, paymentAccountId: "a1", archived: false };
let seq = 0;
const ctx = { workspaceId: "w", card, newId: () => `id${++seq}`, now: "2026-10-19T12:00:00Z" };

describe("buildTransactions", () => {
  it("parcela no cartão gera N linhas com faturas seguidas", () => {
    const rows = buildTransactions({ kind: "expense", amountCents: 10000, occurredOn: "2026-10-19", description: " TV ", cardId: "c1", installments: 3 }, ctx);
    expect(rows.map((r) => r.amountCents)).toEqual([3334, 3333, 3333]);
    expect(rows.map((r) => r.statementMonth)).toEqual(["2026-11-01", "2026-12-01", "2027-01-01"]);
    expect(rows.map((r) => r.installmentNumber)).toEqual([1, 2, 3]);
    expect(new Set(rows.map((r) => r.installmentGroupId)).size).toBe(1);
    expect(rows[0].description).toBe("TV");
    expect(rows[0].accountId).toBeNull();
  });
  it("recusa entradas inválidas", () => {
    const bad = (input: object) => () => buildTransactions({ kind: "expense", amountCents: 100, occurredOn: "2026-10-19", description: "", ...input }, ctx);
    expect(bad({})).toThrow(ValidationError);                                   // nem conta nem cartão
    expect(bad({ accountId: "a1", cardId: "c1" })).toThrow(ValidationError);    // os dois
    expect(bad({ accountId: "a1", amountCents: 0 })).toThrow(ValidationError);
    expect(bad({ accountId: "a1", installments: 2 })).toThrow(ValidationError); // parcelado fora do cartão
    expect(() => buildTransactions({ kind: "transfer", amountCents: 100, occurredOn: "2026-10-19", description: "", accountId: "a1", toAccountId: "a1" }, ctx)).toThrow(ValidationError);
  });
});

describe("resumos", () => {
  const snap: Snapshot = {
    workspace: { id: "w", name: "Casa", currency: "BRL" },
    accounts: [
      { id: "a1", workspaceId: "w", name: "Banco", kind: "checking", initialBalanceCents: 100000, archived: false },
      { id: "a2", workspaceId: "w", name: "Carteira", kind: "wallet", initialBalanceCents: 0, archived: false },
    ],
    cards: [card],
    categories: [
      { id: "k1", workspaceId: "w", name: "Mercado", icon: "shopping-cart", kind: "expense", monthlyLimitCents: 10000, archived: false },
      { id: "k2", workspaceId: "w", name: "Lazer", icon: "party-popper", kind: "expense", monthlyLimitCents: null, archived: false },
    ],
    people: [],
    transactions: [
      ...buildTransactions({ kind: "expense", amountCents: 2500, occurredOn: "2026-10-19", description: "", accountId: "a1", categoryId: "k1" }, ctx),
      ...buildTransactions({ kind: "transfer", amountCents: 5000, occurredOn: "2026-10-19", description: "", accountId: "a1", toAccountId: "a2" }, ctx),
      ...buildTransactions({ kind: "income", amountCents: 300000, occurredOn: "2026-10-05", description: "", accountId: "a1" }, ctx),
      ...buildTransactions({ kind: "expense", amountCents: 18000, occurredOn: "2026-10-19", description: "Luz", accountId: "a1", isPaid: false, dueOn: "2026-10-20" }, ctx),
      ...buildTransactions({ kind: "expense", amountCents: 9000, occurredOn: "2026-10-02", description: "", cardId: "c1", categoryId: "k1" }, ctx),
    ],
  };
  it("saldos batem com o teste do banco", () => {
    const b = accountBalances(snap);
    expect(b.get("a1")).toBe(100000 - 2500 - 5000 + 300000);
    expect(b.get("a2")).toBe(5000);
  });
  it("totais do mês contam o cartão pela fatura", () => {
    const t = monthTotals(snap, "2026-10-01");
    expect(t.incomeCents).toBe(300000);
    expect(t.expenseCents).toBe(2500 + 18000 + 9000);
    expect(t.pendingExpenseCents).toBe(18000);
  });
  it("sobra prevista desconta conta a pagar e fatura do mês", () => {
    expect(projectedLeftover(snap, "2026-10-01")).toBe(392500 + 5000 - 18000 - 9000);
  });
  it("uso por categoria vem ordenado pelo mais perto do limite", () => {
    const u = categoryUsage(snap, "2026-10-01");
    expect(u[0]).toMatchObject({ categoryId: "k1", spentCents: 11500, limitCents: 10000 });
  });
  it("contas a vencer", () => {
    expect(upcomingBills(snap, "2026-10-19").map((t) => t.description)).toEqual(["Luz"]);
    expect(upcomingBills(snap, "2026-10-10")).toEqual([]);
  });
  it("painel separa conta, cartão e pendentes", () => {
    expect(monthBreakdown(snap, "2026-10-01")).toEqual({
      incomeCents: 300000, cashExpenseCents: 2500 + 18000, cardCents: 9000, cardOpenCents: 9000, pendingCents: 18000, pendingCount: 1,
    });
  });
  it("série dos meses termina no mês escolhido", () => {
    const s6 = monthSeries(snap, "2026-11-01", 3);
    expect(s6.map((p) => p.month)).toEqual(["2026-09-01", "2026-10-01", "2026-11-01"]);
    expect(s6[1]).toMatchObject({ incomeCents: 300000, expenseCents: 29500 });
    expect(s6[0].expenseCents).toBe(0);
  });
  it("totais por categoria e por conta", () => {
    expect(totalsByCategory(snap, "2026-10-01", "expense")).toEqual([
      { id: "outros", label: "Outros", cents: 18000 }, { id: "k1", label: "Mercado", cents: 11500 },
    ]);
    expect(incomeByAccount(snap, "2026-10-01")).toEqual([{ id: "a1", label: "Banco", cents: 300000 }]);
  });
  it("extrato da conta com saldo de abertura e saldo corrente", () => {
    const st = accountStatement(snap, "a1", "2026-10-01");
    expect(st.openingCents).toBe(100000);
    expect(st.lines.map((l) => l.deltaCents)).toEqual([300000, -2500, -5000]);
    expect(st.closingCents).toBe(100000 + 300000 - 2500 - 5000);
    expect(accountStatement(snap, "a1", "2026-11-01").openingCents).toBe(st.closingCents);
  });
  it("previsão soma o que falta pagar no mês e acumula o saldo", () => {
    const f = forecast(snap, "2026-10-01", 2);
    expect(f[0]).toMatchObject({ incomeCents: 0, expenseCents: 18000 + 9000, balanceCents: 392500 + 5000 - 27000 });
    expect(f[1].balanceCents).toBe(f[0].balanceCents);
  });
  it("saldo no fim de cada mês e totais por pessoa", () => {
    const b = balanceSeries(snap, "2026-10-01", 2);
    expect(b).toEqual([{ month: "2026-09-01", balanceCents: 100000 }, { month: "2026-10-01", balanceCents: 100000 + 5000 + 300000 - 2500 - 5000 }]);
    expect(totalsByPerson(snap, "2026-10-01", "expense").get("")).toBe(2500 + 18000 + 9000);
  });
  it("exporta CSV que o Excel abre", () => {
    const csv = transactionsCsv(snap, snap.transactions).split("\r\n");
    expect(csv[0]).toBe("Data;Tipo;Descrição;Categoria;Conta ou cartão;Pessoa;Valor;Pago;Parcela");
    expect(csv).toContain("2026-10-19;Despesa;Luz;;Banco;;-180,00;Não;");
  });
});
