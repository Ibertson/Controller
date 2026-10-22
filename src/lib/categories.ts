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

/** A categoria vale para este lado (despesas ou receitas)? "Ambos" vale para os dois. */
export const categoryFits = (c: Pick<Category, "kind">, side: "expense" | "income") => c.kind === side || c.kind === "both";

/** Ícones da tela "Nova categoria": chave (nome do Lucide) e rótulo. */
export const CATEGORY_ICONS: Def[] = [
  ["house", "Casa"], ["car", "Carro"], ["shopping-cart", "Compras"], ["dumbbell", "Fitness"],
  ["party-popper", "Festa"], ["graduation-cap", "Educação"], ["utensils", "Comida"], ["coffee", "Café"],
  ["shirt", "Roupas"], ["plane", "Viagem"], ["fuel", "Combustível"], ["pill", "Farmácia"],
  ["smile", "Dental"], ["sparkles", "Beleza"], ["hand", "Manicure"], ["scissors", "Barbearia"],
  ["tv", "Streaming"], ["share-2", "Redes Sociais"], ["gamepad-2", "Jogos"], ["music", "Música"],
  ["book-open", "Livros"], ["paw-print", "Pet"], ["baby", "Bebê"], ["hammer", "Ferramentas"],
  ["wrench", "Manutenção"], ["truck", "Mudança"], ["gem", "Casamento"], ["landmark", "Finanças"],
  ["trending-up", "Investimentos"], ["briefcase-business", "Negócios"], ["briefcase", "Profissional"], ["bus", "Transporte"],
  ["receipt", "Contas"], ["school", "Faculdade"], ["hand-coins", "Dívidas"], ["percent", "Impostos"],
  ["droplet", "Água"], ["shopping-bag", "Shopping"], ["clapperboard", "Lazer"], ["car-taxi-front", "Táxi"],
  ["utensils-crossed", "Restaurante"], ["piggy-bank", "Poupança"], ["coins", "Moeda"], ["venus", "Mulher"],
  ["mars", "Homem"], ["church", "Igreja"], ["flower-2", "Funerária"], ["lightbulb", "Conta de Luz"],
];

/** Cores da tela "Nova categoria". */
export const CATEGORY_COLORS = [
  "#e055b0", "#ea962a", "#e6df2c", "#6fd35e", "#2d4fd6", "#7b2fe0",
  "#d6281f", "#222222", "#4fdcd6", "#6b3a1e", "#cfcde3", "#3fae5a",
  "#e9cba7", "#74b8e0", "#e3bd1f", "#a9a9a9", "#6e1a22",
];

/** Texto escuro ou claro sobre a cor (luminância relativa). */
export function inkOn(hex: string): "#121a17" | "#ffffff" {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.2 ? "#121a17" : "#ffffff";
}
