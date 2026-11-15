import type { CapitalCategory, CapitalMove } from "./types";

/** Cores das categorias de capital (nome mostrado e valor). */
export const CAPITAL_COLORS = [
  { id: "azul", label: "Azul", hex: "#2563eb" }, { id: "verde", label: "Verde", hex: "#16a34a" },
  { id: "laranja", label: "Laranja", hex: "#ea580c" }, { id: "vermelho", label: "Vermelho", hex: "#dc2626" },
  { id: "roxo", label: "Roxo", hex: "#9333ea" }, { id: "ciano", label: "Ciano", hex: "#0891b2" },
  { id: "amarelo", label: "Amarelo", hex: "#ca8a04" }, { id: "rosa", label: "Rosa", hex: "#db2777" },
  { id: "cinza", label: "Cinza", hex: "#4b5563" },
] as const;
export const colorHex = (id: string) => CAPITAL_COLORS.find((c) => c.id === id)?.hex ?? CAPITAL_COLORS[0].hex;

/** Ícones das categorias (o componente de cada um fica na página). */
export const CAPITAL_ICONS = [
  { id: "carteira", label: "Carteira" }, { id: "estoque", label: "Estoque" }, { id: "lucro", label: "Lucro" },
  { id: "impostos", label: "Impostos" }, { id: "contador", label: "Contador" }, { id: "dinheiro", label: "Dinheiro" },
  { id: "reserva", label: "Reserva" }, { id: "empresa", label: "Empresa" }, { id: "produto", label: "Produto" },
] as const;

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Soma dos percentuais das categorias ativas (sem contar a que está sendo editada). */
export function allocated(cats: CapitalCategory[], exceptId?: string): number {
  return round1(cats.filter((c) => c.active && c.id !== exceptId).reduce((t, c) => t + c.pct, 0));
}
export const available = (cats: CapitalCategory[], exceptId?: string) => round1(Math.max(0, 100 - allocated(cats, exceptId)));

/** Valida uma categoria nova ou editada; devolve as mensagens por campo. */
export function validateCategory(c: Pick<CapitalCategory, "id" | "name" | "pct" | "active">, cats: CapitalCategory[]): Record<string, string> {
  const e: Record<string, string> = {};
  const name = c.name.trim();
  if (!name) e.name = "Informe o nome da categoria.";
  else if (name.length > 60) e.name = "Use até 60 caracteres.";
  else if (cats.some((x) => x.id !== c.id && x.name.trim().toLowerCase() === name.toLowerCase())) e.name = "Já existe uma categoria com esse nome.";
  if (!Number.isFinite(c.pct) || c.pct <= 0) e.pct = "Informe uma porcentagem maior que zero.";
  else if (c.pct > 100) e.pct = "No máximo 100%.";
  else if (c.active && c.pct > available(cats, c.id) + 1e-9) e.pct = `Passa do disponível (${available(cats, c.id).toLocaleString("pt-BR")}%).`;
  return e;
}

/** Valor de cada categoria ativa para um capital; o resto do arredondamento vai para a maior. */
export function distribute(cats: CapitalCategory[], capitalCents: number): { id: string; cents: number }[] {
  const act = cats.filter((c) => c.active && c.pct > 0);
  const parts = act.map((c) => ({ id: c.id, cents: Math.floor(capitalCents * c.pct / 100) }));
  const full = Math.round(capitalCents * allocated(cats) / 100);
  const diff = full - parts.reduce((t, p) => t + p.cents, 0);
  if (parts.length && diff > 0) {
    const big = act.reduce((a, b) => (b.pct > a.pct ? b : a));
    parts.find((p) => p.id === big.id)!.cents += diff;
  }
  return parts;
}

/** Distribuição de um mês, nova (ids gerados) e os ids das que ela substitui. */
export function monthDistribution(cats: CapitalCategory[], moves: CapitalMove[], month: string, capitalCents: number, day: string, newId: () => string, now: string)
  : { save: CapitalMove[]; remove: string[] } {
  const remove = moves.filter((m) => m.kind === "distribuicao" && m.month === month).map((m) => m.id);
  const byId = new Map(cats.map((c) => [c.id, c]));
  const save = distribute(cats, capitalCents).filter((p) => p.cents > 0).map((p): CapitalMove => ({
    id: newId(), categoryId: p.id, categoryName: byId.get(p.id)!.name, kind: "distribuicao", amountCents: p.cents,
    month, movedOn: day, note: `${byId.get(p.id)!.pct.toLocaleString("pt-BR")}% do faturamento`, createdAt: now,
  }));
  return { save, remove };
}

/** Saldo de uma categoria: distribuições + aportes − usos. */
export function balance(moves: CapitalMove[], categoryId: string): number {
  return moves.filter((m) => m.categoryId === categoryId).reduce((t, m) => t + (m.kind === "uso" ? -m.amountCents : m.amountCents), 0);
}

/** O mês já foi distribuído? Devolve o total distribuído ou null. */
export function distributedIn(moves: CapitalMove[], month: string): number | null {
  const d = moves.filter((m) => m.kind === "distribuicao" && m.month === month);
  return d.length ? d.reduce((t, m) => t + m.amountCents, 0) : null;
}

export const MOVE_LABEL: Record<CapitalMove["kind"], string> = { distribuicao: "Distribuição", uso: "Uso", aporte: "Aporte" };
