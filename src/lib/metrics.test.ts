import { describe, expect, it } from "vitest";
import { change, changeText, monthRange, profitMargin } from "./metrics";

describe("Métricas", () => {
  it("variação entre períodos", () => {
    expect(change(150, 100)).toBe(50);
    expect(change(50, 100)).toBe(-50);
    expect(change(0, 0)).toBe(0);
    expect(change(100, 0)).toBeNull();
    expect(change(-50, -100)).toBe(50);
    expect(change(1, 3)).toBe(-66.7);
  });
  it("texto da variação", () => {
    expect(changeText(12.5)).toBe("+12,5%");
    expect(changeText(-3)).toBe("−3,0%");
    expect(changeText(0)).toBe("0,0%");
    expect(changeText(null)).toBe("novo");
  });
  it("margem de lucro", () => {
    expect(profitMargin({ month: "", incomeCents: 1000, expenseCents: 600, balanceCents: 400 })).toBe(40);
    expect(profitMargin({ month: "", incomeCents: 0, expenseCents: 600, balanceCents: -600 })).toBe(0);
    expect(profitMargin({ month: "", incomeCents: 1000, expenseCents: 1500, balanceCents: -500 })).toBe(-50);
  });
  it("meses do intervalo", () => {
    expect(monthRange("2026-11-01", 3)).toEqual(["2026-09-01", "2026-10-01", "2026-11-01"]);
    expect(monthRange("2026-02-01", 3)).toEqual(["2025-12-01", "2026-01-01", "2026-02-01"]);
  });
});
