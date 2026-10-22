import { budgetMonth, monthTotals } from "./summary";
import type { Snapshot, WhatsappNumber } from "./types";

export const MAX_WHATSAPP = 5;

/** "Ibertson Juvino" → "IJ". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return ((parts[0][0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/** "2026-10-19" → "out. de 2026". */
export function memberSinceLabel(day: string): string {
  const [y, m] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("pt-BR", { month: "short", year: "numeric", timeZone: "UTC" });
}

/** Números da seção Estatísticas do perfil. */
export function profileStats(s: Snapshot) {
  const months = [...new Set(s.transactions.filter((t) => t.kind === "income" || t.kind === "expense").map(budgetMonth))];
  const net = months.map((m) => { const t = monthTotals(s, m); return t.incomeCents - t.expenseCents; });
  return {
    transactions: s.transactions.length,
    goalsDone: (s.goals ?? []).filter((g) => g.status === "done").length,
    /** Média de (receitas − despesas) nos meses que têm lançamentos. */
    avgMonthlyCents: net.length ? Math.round(net.reduce((a, b) => a + b, 0) / net.length) : 0,
  };
}

/** Adiciona um número; o primeiro vira principal. Erro em texto quando não pode. */
export function addWhatsapp(list: WhatsappNumber[], n: Omit<WhatsappNumber, "primary">): WhatsappNumber[] | string {
  if (list.length >= MAX_WHATSAPP) return `Você já tem ${MAX_WHATSAPP} números.`;
  if (list.some((x) => x.phone === n.phone)) return "Esse número já está na lista.";
  if (list.some((x) => x.personId === n.personId)) return n.personId ? "Essa pessoa já tem um número." : "Você já cadastrou o seu número.";
  return [...list, { ...n, primary: list.length === 0 }];
}

/** Remove um número; se era o principal, o primeiro que sobrar vira principal. */
export function removeWhatsapp(list: WhatsappNumber[], phone: string): WhatsappNumber[] {
  const rest = list.filter((x) => x.phone !== phone);
  return rest.length && !rest.some((x) => x.primary) ? rest.map((x, i) => ({ ...x, primary: i === 0 })) : rest;
}

export const setPrimaryWhatsapp = (list: WhatsappNumber[], phone: string) => list.map((x) => ({ ...x, primary: x.phone === phone }));

export interface PasswordCheck { current?: string; next?: string; confirm?: string }

/** Valida o formulário de senha; objeto vazio = tudo certo. */
export function checkPassword(hasPassword: boolean, current: string, next: string, confirm: string): PasswordCheck {
  const e: PasswordCheck = {};
  if (hasPassword && !current) e.current = "Digite sua senha atual.";
  if (next.length < 8) e.next = "Use pelo menos 8 caracteres.";
  else if (!/[A-Za-z]/.test(next) || !/\d/.test(next)) e.next = "Misture letras e números.";
  if (!confirm) e.confirm = "Confirme a nova senha.";
  else if (confirm !== next) e.confirm = "As senhas não são iguais.";
  return e;
}
