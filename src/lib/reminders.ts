// Lembretes: tipos, repetição e situação (vencido, hoje, em X dias).
import type { Reminder, ReminderType } from "./types";

export const REMINDER_TYPES: [ReminderType, string][] = [
  ["casa", "Casa"], ["reforma", "Reforma de Casa"], ["manutencao", "Manutenção"], ["carro", "Carro"], ["moto", "Moto"], ["outro", "Outro"],
];
export const reminderTypeLabel = (t: ReminderType) => REMINDER_TYPES.find(([k]) => k === t)?.[1] ?? "Outro";

export const REPEAT_OPTIONS: [Reminder["repeatDays"], string][] = [
  [0, "Não repete"], [30, "A cada 30 dias"], [90, "A cada 90 dias"], [180, "A cada 180 dias"], [365, "A cada 365 dias"],
];
export const repeatLabel = (d: Reminder["repeatDays"]) => REPEAT_OPTIONS.find(([k]) => k === d)?.[1] ?? "Não repete";

const DAY = 86400000;
const toTime = (d: string) => Date.parse(d + "T00:00:00Z");
export const addDays = (d: string, n: number) => new Date(toTime(d) + n * DAY).toISOString().slice(0, 10);
export const daysBetween = (from: string, to: string) => Math.round((toTime(to) - toTime(from)) / DAY);

/** "Vencido há 3 dias", "Vence hoje", "Amanhã", "Em 12 dias". */
export function dueStatus(dueOn: string, todayStr: string): { tone: "late" | "today" | "soon" | "later"; label: string } {
  const n = daysBetween(todayStr, dueOn);
  if (n < 0) return { tone: "late", label: n === -1 ? "Venceu ontem" : `Vencido há ${-n} dias` };
  if (n === 0) return { tone: "today", label: "Vence hoje" };
  if (n === 1) return { tone: "soon", label: "Amanhã" };
  return { tone: n <= 7 ? "soon" : "later", label: `Em ${n} dias` };
}

/**
 * O que muda ao concluir: sem repetição, vai para Concluídos; com repetição, a próxima data
 * conta a partir do dia em que foi feito (hoje) e o lembrete continua ativo.
 */
export function completeReminder(r: Reminder, todayStr: string, nowIso: string): Reminder {
  if (!r.repeatDays) return { ...r, doneAt: nowIso, lastDoneOn: todayStr };
  return { ...r, dueOn: addDays(todayStr, r.repeatDays), lastDoneOn: todayStr, doneAt: null };
}

/** Só dígitos; número brasileiro sem DDI (10 ou 11 dígitos) ganha o 55. null se vazio ou inválido. */
export function normalizeWhatsapp(input: string): string | null {
  let d = input.replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) d = "55" + d;
  return /^\d{12,15}$/.test(d) ? d : null;
}

/** "+55 (11) 99999-9999" para mostrar um número salvo. */
export function formatWhatsapp(d: string): string {
  const m = /^55(\d{2})(\d{4,5})(\d{4})$/.exec(d);
  return m ? `+55 (${m[1]}) ${m[2]}-${m[3]}` : `+${d}`;
}

/** Texto do lembrete para o WhatsApp. */
export function reminderMessage(r: Pick<Reminder, "title" | "type" | "dueOn" | "repeatDays" | "notes">, todayStr: string): string {
  const [y, m, d] = r.dueOn.split("-");
  const lines = [`🔔 Lembrete: ${r.title}`, `${reminderTypeLabel(r.type)} · ${d}/${m}/${y} (${dueStatus(r.dueOn, todayStr).label.toLowerCase()})`];
  if (r.repeatDays) lines.push(`Repete ${repeatLabel(r.repeatDays).toLowerCase()}`);
  if (r.notes) lines.push(r.notes);
  return lines.join("\n");
}

/** Link que abre o WhatsApp com a mensagem pronta (sem número, o WhatsApp pede o contato). */
export const whatsappLink = (text: string, phone: string | null) => `https://wa.me/${phone ?? ""}?text=${encodeURIComponent(text)}`;
