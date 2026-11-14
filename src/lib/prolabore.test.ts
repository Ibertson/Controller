import { describe, expect, it } from "vitest";
import { clampPct, suggested, withdrawalDay, withdrawnPct } from "./prolabore";

describe("Pró-Labore", () => {
  it("sugere o percentual do faturamento", () => {
    expect(suggested(1000000, 33)).toBe(330000);
    expect(suggested(0, 33)).toBe(0);
    expect(suggested(99999, 33)).toBe(32999);
  });
  it("percentual fica entre 10 e 70", () => {
    expect(clampPct(undefined)).toBe(33);
    expect(clampPct(5)).toBe(10);
    expect(clampPct(90)).toBe(70);
  });
  it("percentual retirado", () => {
    expect(withdrawnPct(300000, 1000000)).toBe(30);
    expect(withdrawnPct(100, 0)).toBeNull();
  });
  it("data do lançamento conforme o mês", () => {
    expect(withdrawalDay("2026-11", "2026-11-14")).toBe("2026-11-14");
    expect(withdrawalDay("2026-10", "2026-11-14")).toBe("2026-10-31");
    expect(withdrawalDay("2027-01", "2026-11-14")).toBe("2027-01-01");
  });
});
