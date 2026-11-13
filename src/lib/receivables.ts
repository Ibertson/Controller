// Clientes & Recebíveis: parcelas, situação de cada conta e os números do topo.
import { addMonthsToDay } from "./dates";
import { splitInstallments } from "./money";
import { addDays } from "./stock";
import type { BusinessClient, ClientKind, Receivable } from "./types";

export const CLIENT_KINDS: { id: ClientKind; label: string }[] = [
  { id: "eventual", label: "Eventual" },
  { id: "recorrente", label: "Recorrente" },
];
export const clientKindLabel = (k: ClientKind) => CLIENT_KINDS.find((x) => x.id === k)?.label ?? k;

export type ReceivableState = "received" | "overdue" | "open";
export function receivableState(r: Pick<Receivable, "receivedOn" | "dueOn">, todayStr: string): ReceivableState {
  if (r.receivedOn) return "received";
  return r.dueOn < todayStr ? "overdue" : "open";
}

/** Divide a conta em parcelas mensais (a 1ª leva os centavos que sobram). */
export function buildInstallments(input: { description: string; totalCents: number; firstDue: string; clientId: string | null; installments: number },
  newId: () => string, nowIso: string): Receivable[] {
  const n = Math.max(1, Math.min(48, Math.floor(input.installments)));
  const groupId = newId();
  return splitInstallments(input.totalCents, n).map((cents, i) => ({
    id: newId(), groupId, description: input.description, amountCents: cents, dueOn: addMonthsToDay(input.firstDue, i),
    clientId: input.clientId, installment: i + 1, installments: n, receivedOn: null, transactionId: null, deletedAt: null, createdAt: nowIso,
  }));
}

/** Cartões do topo (só contas ativas e em aberto). */
export function receivableSummary(list: Receivable[], todayStr: string) {
  const until = addDays(todayStr, 7);
  let total = 0, overdue = 0, next7 = 0;
  for (const r of list) {
    if (r.deletedAt || r.receivedOn) continue;
    total += r.amountCents;
    if (r.dueOn < todayStr) overdue += r.amountCents;
    else if (r.dueOn <= until) next7 += r.amountCents;
  }
  return { totalCents: total, overdueCents: overdue, next7Cents: next7 };
}

export type ReceivableView = "month" | "overdue" | "next7";
/** Contas ativas para a lista: do mês escolhido, vencidas ou dos próximos 7 dias. */
export function filterReceivables(list: Receivable[], view: ReceivableView, month: string, todayStr: string): Receivable[] {
  const until = addDays(todayStr, 7);
  return list.filter((r) => !r.deletedAt && (
    view === "overdue" ? !r.receivedOn && r.dueOn < todayStr
      : view === "next7" ? !r.receivedOn && r.dueOn >= todayStr && r.dueOn <= until
        : r.dueOn.startsWith(month)))
    .sort((a, b) => a.dueOn.localeCompare(b.dueOn) || a.installment - b.installment);
}

/** Quanto cada cliente tem em aberto. */
export function openByClient(list: Receivable[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of list) if (!r.deletedAt && !r.receivedOn && r.clientId) out[r.clientId] = (out[r.clientId] ?? 0) + r.amountCents;
  return out;
}

const fold = (v: string) => v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
export const sortClients = (list: BusinessClient[]) => [...list].sort((a, b) => fold(a.name).localeCompare(fold(b.name)));

/** Link do WhatsApp para o telefone (Brasil quando vier sem o 55). */
export function whatsappLink(phone: string): string | null {
  const d = phone.replace(/\D/g, "");
  if (d.length < 10) return null;
  return `https://wa.me/${d.length <= 11 ? `55${d}` : d}`;
}

/** (11) 99999-9999 enquanto digita. */
export function maskPhone(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
