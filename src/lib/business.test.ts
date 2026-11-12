import { describe, expect, it } from "vitest";
import { cashFlow, companyTypeInfo, dre, dreGroup, formatCnae, formatCnpj, fromBrasilApi, isValidCnpj, overdue, parseCents, priceFor } from "./business";
import { emptySnapshot } from "./data/seed";
import { buildTransactions } from "./transactions";
import type { Snapshot } from "./types";

let n = 0;
const id = () => `id${++n}`;

function biz(): Snapshot {
  return emptySnapshot(id, { name: "Loja", cnpj: null, activity: "Comércio", companyType: "mei" });
}
function add(s: Snapshot, input: Parameters<typeof buildTransactions>[0]) {
  s.transactions.push(...buildTransactions(input, { workspaceId: s.workspace.id, newId: id, now: "2026-01-01T00:00:00Z" }));
}
const cat = (s: Snapshot, name: string) => s.categories.find((c) => c.name === name)!.id;

describe("CNPJ", () => {
  it("valida dígitos e formata", () => {
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
    expect(isValidCnpj("11.222.333/0001-82")).toBe(false);
    expect(isValidCnpj("11111111111111")).toBe(false);
    expect(formatCnpj("11222333000181")).toBe("11.222.333/0001-81");
    expect(formatCnpj("112223")).toBe("11.222.3");
  });
});

describe("espaço da empresa", () => {
  it("nasce com categorias empresariais", () => {
    const s = biz();
    expect(s.workspace).toMatchObject({ kind: "business", name: "Loja", companyType: "mei" });
    expect(s.categories.map((c) => c.name)).toContain("Pró-labore");
    expect(s.categories.map((c) => c.name)).not.toContain("Pet");
  });
});

describe("fluxo de caixa e DRE", () => {
  const s = biz();
  const acc = s.accounts[0].id;
  s.accounts[0].initialBalanceCents = 100000;
  add(s, { kind: "income", amountCents: 50000, occurredOn: "2025-12-10", description: "venda antiga", accountId: acc, isPaid: true });
  add(s, { kind: "income", amountCents: 300000, occurredOn: "2026-03-05", description: "vendas", accountId: acc, isPaid: true, categoryId: cat(s, "Venda de produtos") });
  add(s, { kind: "expense", amountCents: 100000, occurredOn: "2026-03-06", description: "estoque", accountId: acc, isPaid: true, categoryId: cat(s, "Fornecedores/Mercadorias") });
  add(s, { kind: "expense", amountCents: 20000, occurredOn: "2026-03-07", description: "DAS", accountId: acc, isPaid: true, categoryId: cat(s, "Impostos") });
  add(s, { kind: "expense", amountCents: 30000, occurredOn: "2026-03-08", description: "aluguel", accountId: acc, isPaid: true, categoryId: cat(s, "Aluguel") });
  add(s, { kind: "expense", amountCents: 50000, occurredOn: "2026-03-09", description: "retirada", accountId: acc, isPaid: true, categoryId: cat(s, "Pró-labore") });
  add(s, { kind: "expense", amountCents: 7000, occurredOn: "2026-03-20", description: "luz", accountId: acc, isPaid: false, dueOn: "2026-03-20", categoryId: cat(s, "Conta de Luz") });

  it("fluxo de caixa", () => {
    const f = cashFlow(s, 2026);
    expect(f.openingCents).toBe(150000);
    expect(f.months[2]).toMatchObject({ inCents: 300000, outCents: 200000, netCents: 100000, closingCents: 250000, toPayCents: 7000 });
    expect(f.months[11].closingCents).toBe(250000);
  });

  it("DRE simplificado", () => {
    const d = dre(s, "2026-03-01");
    expect(d).toMatchObject({ grossCents: 300000, taxesCents: 20000, netRevenueCents: 280000, costsCents: 100000,
      grossProfitCents: 180000, opexCents: 37000, operatingCents: 143000, prolaboreCents: 50000, financialCents: 0, resultCents: 93000 });
    expect(dreGroup(undefined)).toBe("opex");
  });

  it("pendências vencidas", () => {
    expect(overdue(s, "2026-03-25").map((p) => [p.kind, p.title])).toEqual([["pay", "luz"]]);
    expect(overdue(s, "2026-03-20")).toEqual([]);
  });
});

describe("precificação", () => {
  it("markup divisor", () => {
    const r = priceFor({ costCents: 1000, fixedPct: 10, taxPct: 6, feePct: 4, commissionPct: 0, marginPct: 20 })!;
    expect(r.priceCents).toBe(1667);
    expect(r.profitCents).toBe(1667 - 1000 - 167 - 100 - 67);
    expect(priceFor({ costCents: 1000, fixedPct: 50, taxPct: 0, feePct: 0, commissionPct: 0, marginPct: 50 })).toBeNull();
  });
});

describe("cadastro da empresa", () => {
  it("tipos novos e antigos têm nome e dica", () => {
    expect(companyTypeInfo("mei")?.hint).toBe("Limite anual: R$ 81.000,00");
    expect(companyTypeInfo("epp_simples")?.hint).toBe("Limite anual: até R$ 4.800.000,00");
    expect(companyTypeInfo("presumido")?.hint).toBe("Regime tributário: Lucro Presumido");
    expect(companyTypeInfo("ltda")?.short).toBe("LTDA");
    expect(companyTypeInfo("me_simples")?.short).toBe("ME - Simples Nacional");
  });
  it("valor do DAS e CNAE", () => {
    expect(parseCents("75,60")).toBe(7560);
    expect(parseCents("R$ 1.234,5")).toBe(123450);
    expect(parseCents("")).toBeNull();
    expect(formatCnae("6201501")).toBe("6201-5/01");
    expect(formatCnae("62015")).toBe("6201-5");
  });
  it("lê a resposta da BrasilAPI", () => {
    expect(fromBrasilApi({ razao_social: "EMPRESA X LTDA", nome_fantasia: "", email: "Contato@X.com", municipio: "SAO PAULO", uf: "sp", cnae_fiscal: 6201501, data_inicio_atividade: "2020-03-01" }))
      .toEqual({ legalName: "EMPRESA X LTDA", tradeName: undefined, email: "contato@x.com", city: "Sao Paulo", uf: "SP", cnae: "6201501", openedOn: "2020-03-01" });
  });
});
