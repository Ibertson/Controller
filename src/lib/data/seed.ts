import type { Category, Snapshot } from "../types";

// Categorias iniciais: nomes genéricos, escolhidos para o Sobra. Ícones são nomes do Lucide.
const expense: [string, string][] = [
  ["Mercado", "shopping-cart"], ["Casa", "house"], ["Contas", "receipt"], ["Transporte", "car"],
  ["Restaurantes", "utensils"], ["Saúde", "heart-pulse"], ["Educação", "graduation-cap"],
  ["Lazer", "party-popper"], ["Compras", "shopping-bag"], ["Assinaturas", "repeat"], ["Outros", "ellipsis"],
];
const income: [string, string][] = [["Salário", "briefcase"], ["Extra", "sparkles"], ["Rendimentos", "trending-up"]];

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
