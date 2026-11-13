import { describe, expect, it } from "vitest";
import { buildInstallments, filterReceivables, maskPhone, openByClient, receivableState, receivableSummary, whatsappLink } from "./receivables";
import type { Receivable } from "./types";

let n = 0;
const id = () => `id${++n}`;
const rec = (o: Partial<Receivable>): Receivable => ({
  id: id(), groupId: "g", description: "Consultoria", amountCents: 10000, dueOn: "2026-11-20", clientId: "c1",
  installment: 1, installments: 1, receivedOn: null, transactionId: null, deletedAt: null, createdAt: "", ...o,
});

describe("recebíveis", () => {
  it("divide em parcelas mensais", () => {
    const l = buildInstallments({ description: "Site", totalCents: 100000, firstDue: "2026-01-31", clientId: null, installments: 3 }, id, "x");
    expect(l.map((r) => r.amountCents)).toEqual([33334, 33333, 33333]);
    expect(l.map((r) => r.dueOn)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
    expect(new Set(l.map((r) => r.groupId)).size).toBe(1);
    expect(l[2]).toMatchObject({ installment: 3, installments: 3 });
  });
  it("cartões: total, vencidos e próximos 7 dias", () => {
    const list = [rec({ dueOn: "2026-11-10" }), rec({ dueOn: "2026-11-13", amountCents: 5000 }), rec({ dueOn: "2026-11-20", amountCents: 2000 }),
      rec({ dueOn: "2026-11-21", amountCents: 700 }), rec({ dueOn: "2026-11-01", receivedOn: "2026-11-01" }), rec({ dueOn: "2026-11-02", deletedAt: "x" })];
    expect(receivableSummary(list, "2026-11-13")).toEqual({ totalCents: 17700, overdueCents: 10000, next7Cents: 7000 });
    expect(filterReceivables(list, "overdue", "", "2026-11-13")).toHaveLength(1);
    expect(filterReceivables(list, "next7", "", "2026-11-13")).toHaveLength(2);
    expect(filterReceivables(list, "month", "2026-11", "2026-11-13")).toHaveLength(5);
    expect(openByClient(list)).toEqual({ c1: 17700 });
  });
  it("situação, telefone e WhatsApp", () => {
    expect(receivableState(rec({ dueOn: "2026-11-12" }), "2026-11-13")).toBe("overdue");
    expect(receivableState(rec({ dueOn: "2026-11-13" }), "2026-11-13")).toBe("open");
    expect(receivableState(rec({ receivedOn: "2026-11-13" }), "2026-11-13")).toBe("received");
    expect(maskPhone("81999998888")).toBe("(81) 99999-8888");
    expect(maskPhone("8133334444")).toBe("(81) 3333-4444");
    expect(whatsappLink("(81) 99999-8888")).toBe("https://wa.me/5581999998888");
    expect(whatsappLink("123")).toBeNull();
  });
});
