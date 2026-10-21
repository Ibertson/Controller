// Categorias padrão do Sobra e o ajuste das contas que já existem (só acrescenta; não apaga nada).
import type { Category } from "./types";

type Def = [name: string, icon: string];

export const DEFAULT_EXPENSE: Def[] = [
  ["Contas e Serviços", "receipt"], ["Cuidados Pessoais", "sparkles"], ["Pet", "paw-print"], ["Família", "users"],
  ["Aluguel/Financiamento", "key-round"], ["Água", "droplet"], ["Conta de Luz", "lightbulb"], ["Manutenção", "wrench"],
  ["Mercado", "shopping-cart"], ["Restaurante", "utensils"], ["Combustível", "fuel"], ["Táxi/App", "car-taxi-front"],
  ["Manutenção Veicular", "car"], ["Farmácia", "pill"], ["Dental", "smile"], ["Faculdade", "graduation-cap"],
  ["Streaming", "tv"], ["Viagem", "plane"], ["Roupas", "shirt"], ["Internet/Telefone", "wifi"], ["Barbearia/Cabelo", "scissors"],
  ["Moradia", "house"], ["Alimentação", "apple"], ["Transporte", "bus"], ["Saúde", "heart-pulse"], ["Educação", "book-open"],
  ["Lazer", "party-popper"], ["Compras", "shopping-bag"], ["Outros", "ellipsis"],
];
export const DEFAULT_INCOME: Def[] = [["Salário", "briefcase"], ["Freelance/Extra", "sparkles"], ["Investimentos", "trending-up"]];

/** Nomes antigos do Sobra que viram os novos, mantendo os lançamentos ligados. */
const RENAMES: Record<string, string> = {
  "expense:restaurantes": "Restaurante", "expense:contas": "Contas e Serviços", "expense:casa": "Moradia",
  "income:extra": "Freelance/Extra", "income:rendimentos": "Investimentos",
};

export const normName = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export type CategoryChange = Omit<Category, "workspaceId" | "id"> & { id?: string };

/** O que falta para a conta ter todas as categorias padrão: renomeia as antigas equivalentes e cria as que faltam. */
export function defaultCategoryChanges(existing: Category[]): CategoryChange[] {
  const have = new Set(existing.map((c) => `${c.kind}:${normName(c.name)}`));
  const out: CategoryChange[] = [];
  for (const c of existing) {
    const to = RENAMES[`${c.kind}:${normName(c.name)}`];
    if (to && !have.has(`${c.kind}:${normName(to)}`)) {
      out.push({ ...c, name: to });
      have.add(`${c.kind}:${normName(to)}`);
    }
  }
  const add = (kind: Category["kind"]) => ([name, icon]: Def) => {
    if (have.has(`${kind}:${normName(name)}`)) return;
    have.add(`${kind}:${normName(name)}`);
    out.push({ name, icon, kind, monthlyLimitCents: null, archived: false });
  };
  DEFAULT_EXPENSE.forEach(add("expense"));
  DEFAULT_INCOME.forEach(add("income"));
  return out;
}
