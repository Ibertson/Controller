import type { Category, Snapshot } from "../types";
import { DEFAULT_EXPENSE as expense, DEFAULT_INCOME as income } from "../categories";

export function emptySnapshot(newId: () => string): Snapshot {
  const workspaceId = newId();
  const cat = (kind: Category["kind"]) => ([name, icon]: [string, string]): Category =>
    ({ id: newId(), workspaceId, name, icon, kind, monthlyLimitCents: null, archived: false });
  return {
    workspace: { id: workspaceId, name: "Pessoal", currency: "BRL" },
    accounts: [{ id: newId(), workspaceId, name: "Conta principal", kind: "checking", initialBalanceCents: 0, archived: false }],
    cards: [],
    categories: [...expense.map(cat("expense")), ...income.map(cat("income"))],
    people: [],
    transactions: [],
  };
}
