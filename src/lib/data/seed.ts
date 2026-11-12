import type { Category, Company, Snapshot } from "../types";
import { defaultsFor } from "../categories";

/** Espaço novo: conta principal e categorias padrão (pessoais ou da empresa). */
export function emptySnapshot(newId: () => string, company?: Company): Snapshot {
  const workspaceId = newId();
  const cat = (kind: Category["kind"]) => ([name, icon]: [string, string]): Category =>
    ({ id: newId(), workspaceId, name, icon, kind, monthlyLimitCents: null, archived: false });
  return {
    workspace: company
      ? { id: workspaceId, name: company.name, currency: "BRL", kind: "business", cnpj: company.cnpj, activity: company.activity, companyType: company.companyType }
      : { id: workspaceId, name: "Pessoal", currency: "BRL", kind: "personal" },
    accounts: [{ id: newId(), workspaceId, name: "Conta principal", kind: "checking", initialBalanceCents: 0, archived: false }],
    cards: [],
    categories: [...defaultsFor(company ? "business" : "personal").expense.map(cat("expense")), ...defaultsFor(company ? "business" : "personal").income.map(cat("income"))],
    people: [],
    transactions: [],
  };
}
