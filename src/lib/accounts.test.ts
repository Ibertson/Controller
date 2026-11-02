import { describe, expect, it } from "vitest";
import { accountName, accountStats, accountTitle, balanceBreakdown, bankInitials, initialForCurrent } from "./accounts";
import type { Account, Snapshot, Transaction } from "./types";

const acc = (id: string, extra: Partial<Account> = {}): Account =>
  ({ id, workspaceId: "w", name: id, kind: "checking", initialBalanceCents: 1000, archived: false, ...extra });
let n = 0;
const tx = (p: Partial<Transaction>): Transaction => ({
  id: `t${++n}`, workspaceId: "w", kind: "expense", amountCents: 100, occurredOn: "2026-11-05", description: "",
  categoryId: null, accountId: "a", toAccountId: null, cardId: null, statementMonth: null, personId: null,
  installmentGroupId: null, installmentNumber: null, installmentTotal: null, isPaid: true, dueOn: null, source: "app", createdAt: "", ...p,
});
const snap = (accounts: Account[], transactions: Transaction[]): Snapshot =>
  ({ workspace: { id: "w", name: "P", currency: "BRL" }, accounts, cards: [], categories: [], people: [], transactions });

describe("contas", () => {
  it("monta nome e iniciais", () => {
    expect(accountName("Banco do Brasil", "Reserva")).toBe("Banco do Brasil · Reserva");
    expect(accountName("Inter", "")).toBe("Inter");
    expect(bankInitials("Banco do Brasil")).toBe("BB");
    expect(bankInitials("Nubank")).toBe("NU");
    expect(accountTitle({ name: "Conta principal", bank: null, label: null })).toBe("Conta principal");
  });

  it("soma o mês, subcontas e cheque especial", () => {
    const a = acc("a", { overdraftCents: 50000 });
    const s = snap([a, acc("b", { parentId: "a", initialBalanceCents: 300 }), acc("c")], [
      tx({ kind: "income", amountCents: 5000 }),
      tx({ amountCents: 700 }),
      tx({ amountCents: 900, cardId: "k" }), // cartão: fica fora
      tx({ amountCents: 200, occurredOn: "2026-10-30" }),
      tx({ kind: "transfer", amountCents: 400, accountId: "c", toAccountId: "a" }),
    ]);
    const st = accountStats(s, a, "2026-11-01");
    expect(st.incomeCents).toBe(5000);
    expect(st.expenseCents).toBe(700);
    expect(st.subTotalCents).toBe(300);
    expect(st.availableCents).toBe(st.balanceCents + 300 + 50000);
    expect(balanceBreakdown(s, a)).toEqual({ initialCents: 1000, inCents: 5400, outCents: 900, totalCents: 1000 + 5400 - 900 });
  });

  it("acha o saldo inicial para um saldo de hoje", () => {
    const a = acc("a");
    const s = snap([a], [tx({ amountCents: 300 })]);
    expect(initialForCurrent(s, a, 2000)).toBe(2300);
  });
});

describe("bancos", () => {
  it("busca sem acento e mantém a ordem", async () => {
    const { searchBanks, BANKS, avatarColor } = await import("./accounts");
    expect(BANKS[0]).toBe("Nubank");
    expect(searchBanks("itau")).toEqual(["Itaú", "Itaú Empresas", "Itaú Iti", "Itaú Personnalité"]);
    expect(searchBanks("brasilia")).toEqual(["Banco BRB (Banco de Brasília)"]);
    expect(searchBanks("").length).toBe(BANKS.length);
    expect(new Set(BANKS).size).toBe(BANKS.length);
    expect(avatarColor("Nubank")).toBe(avatarColor("Nubank"));
  });
});
