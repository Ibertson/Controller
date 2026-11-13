import { describe, expect, it } from "vitest";
import { activityCounts, clientSuggestions, filterActivities, isOverdue, neighborStatus } from "./activities";
import type { Activity } from "./types";

const act = (o: Partial<Activity>): Activity => ({
  id: "a", clientName: "Maria Souza", serviceId: null, title: "Limpeza de ar-condicionado", valueCents: 25000,
  dueOn: "2026-11-20", notes: "", status: "todo", createdAt: "", ...o,
});

describe("atividades", () => {
  const list = [act({}), act({ id: "b", clientName: "João", title: "Pintura", status: "doing", valueCents: 80000, dueOn: "2026-12-02" }),
    act({ id: "c", clientName: "José", status: "done", dueOn: "2026-11-01" })];
  it("filtra por busca sem acento, status e mês", () => {
    expect(filterActivities(list, { q: "joao", status: "all", month: "" }).map((a) => a.id)).toEqual(["b"]);
    expect(filterActivities(list, { q: "AR-COND", status: "all", month: "" }).map((a) => a.id)).toEqual(["a", "c"]);
    expect(filterActivities(list, { q: "", status: "done", month: "" }).map((a) => a.id)).toEqual(["c"]);
    expect(filterActivities(list, { q: "", status: "all", month: "2026-11" }).map((a) => a.id)).toEqual(["a", "c"]);
  });
  it("conta e soma por coluna", () => {
    const c = activityCounts(list);
    expect(c.todo).toEqual({ n: 1, cents: 25000 });
    expect(c.doing).toEqual({ n: 1, cents: 80000 });
    expect(c.waiting).toEqual({ n: 0, cents: 0 });
    expect(c.done.n).toBe(1);
  });
  it("atrasada só se não concluída", () => {
    expect(isOverdue(act({ dueOn: "2026-11-01" }), "2026-11-13")).toBe(true);
    expect(isOverdue(act({ dueOn: "2026-11-13" }), "2026-11-13")).toBe(false);
    expect(isOverdue(act({ dueOn: "2026-11-01", status: "done" }), "2026-11-13")).toBe(false);
  });
  it("coluna vizinha e sugestões de cliente", () => {
    expect(neighborStatus("todo", -1)).toBeNull();
    expect(neighborStatus("todo", 1)).toBe("doing");
    expect(neighborStatus("done", 1)).toBeNull();
    expect(clientSuggestions(["Maria", " João "], ["maria", "Ana"])).toEqual(["Ana", "João", "Maria"]);
  });
});
