import { describe, expect, it } from "vitest";
import { allocated, available, balance, distribute, distributedIn, monthDistribution, validateCategory } from "./capital";
import type { CapitalCategory, CapitalMove } from "./types";

const cat = (id: string, pct: number, active = true): CapitalCategory => ({ id, name: id, pct, icon: "carteira", color: "azul", description: "", active, createdAt: "2026-01-01" });
const cats = [cat("Estoque", 40), cat("Impostos", 10), cat("Lucro", 25.5), cat("Parada", 20, false)];

describe("alocação", () => {
  it("soma só as ativas", () => {
    expect(allocated(cats)).toBe(75.5);
    expect(available(cats)).toBe(24.5);
    expect(available(cats, "Estoque")).toBe(64.5);
  });
  it("valida nome e porcentagem", () => {
    expect(validateCategory({ id: "n", name: " ", pct: 0, active: true }, cats)).toEqual({ name: "Informe o nome da categoria.", pct: "Informe uma porcentagem maior que zero." });
    expect(validateCategory({ id: "n", name: "lucro", pct: 30, active: true }, cats).name).toBe("Já existe uma categoria com esse nome.");
    expect(validateCategory({ id: "n", name: "Reserva", pct: 30, active: true }, cats).pct).toMatch(/Passa do disponível \(24,5%\)/);
    expect(validateCategory({ id: "n", name: "Reserva", pct: 30, active: false }, cats)).toEqual({});
    expect(validateCategory({ id: "Estoque", name: "Estoque", pct: 64.5, active: true }, cats)).toEqual({});
  });
});

describe("distribuição", () => {
  it("divide o capital pelas ativas sem perder centavos", () => {
    const d = distribute(cats, 100_001);
    expect(d).toEqual([{ id: "Estoque", cents: 40_001 }, { id: "Impostos", cents: 10_000 }, { id: "Lucro", cents: 25_500 }]);
    expect(d.reduce((t, p) => t + p.cents, 0)).toBe(Math.round(100_001 * 0.755));
  });
  it("redistribuir troca as do mês e o saldo soma usos e aportes", () => {
    let n = 0;
    const old: CapitalMove[] = [
      { id: "d1", categoryId: "Estoque", categoryName: "Estoque", kind: "distribuicao", amountCents: 999, month: "2026-11", movedOn: "2026-11-02", note: "", createdAt: "" },
      { id: "u1", categoryId: "Estoque", categoryName: "Estoque", kind: "uso", amountCents: 1500, month: "2026-11", movedOn: "2026-11-03", note: "", createdAt: "" },
      { id: "a1", categoryId: "Estoque", categoryName: "Estoque", kind: "aporte", amountCents: 500, month: "2026-11", movedOn: "2026-11-04", note: "", createdAt: "" },
    ];
    const r = monthDistribution(cats, old, "2026-11", 10_000, "2026-11-15", () => `m${++n}`, "t");
    expect(r.remove).toEqual(["d1"]);
    expect(r.save.map((m) => [m.categoryId, m.amountCents, m.note])).toEqual([["Estoque", 4000, "40% do faturamento"], ["Impostos", 1000, "10% do faturamento"], ["Lucro", 2550, "25,5% do faturamento"]]);
    const after = [...old.filter((m) => !r.remove.includes(m.id)), ...r.save];
    expect(balance(after, "Estoque")).toBe(4000 - 1500 + 500);
    expect(distributedIn(after, "2026-11")).toBe(7550);
    expect(distributedIn(after, "2026-10")).toBeNull();
  });
});
