// Agenda / Atividades: colunas do quadro, contagens, filtros e sugestões de cliente.
import type { Activity, ActivityStatus } from "./types";

export const ACTIVITY_STATUSES: { id: ActivityStatus; label: string; short: string }[] = [
  { id: "todo", label: "A Fazer", short: "A fazer" },
  { id: "doing", label: "Em Progresso", short: "Em progresso" },
  { id: "waiting", label: "Aguardando Pagamento", short: "Aguardando" },
  { id: "done", label: "Concluído", short: "Concluídos" },
];
export const statusLabel = (s: ActivityStatus) => ACTIVITY_STATUSES.find((x) => x.id === s)?.label ?? s;

const fold = (v: string) => v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export interface ActivityFilter { q: string; status: ActivityStatus | "all"; /** "2026-11" ou "" = todos os meses. */ month: string }

/** Busca por cliente ou serviço, status e mês do vencimento. */
export function filterActivities(list: Activity[], f: ActivityFilter): Activity[] {
  const q = fold(f.q);
  return list.filter((a) => (f.status === "all" || a.status === f.status)
    && (!f.month || a.dueOn.startsWith(f.month))
    && (!q || fold(a.clientName).includes(q) || fold(a.title).includes(q)));
}

/** Quantidade e valor de cada coluna. */
export function activityCounts(list: Activity[]): Record<ActivityStatus, { n: number; cents: number }> {
  const out = { todo: { n: 0, cents: 0 }, doing: { n: 0, cents: 0 }, waiting: { n: 0, cents: 0 }, done: { n: 0, cents: 0 } };
  for (const a of list) { out[a.status].n += 1; out[a.status].cents += a.valueCents; }
  return out;
}

/** Venceu e ainda não foi concluída. */
export const isOverdue = (a: Pick<Activity, "dueOn" | "status">, todayStr: string) => a.status !== "done" && a.dueOn < todayStr;

/** Coluna anterior e seguinte (para mover o cartão com as setas). */
export function neighborStatus(s: ActivityStatus, dir: -1 | 1): ActivityStatus | null {
  const i = ACTIVITY_STATUSES.findIndex((x) => x.id === s) + dir;
  return ACTIVITY_STATUSES[i]?.id ?? null;
}

/** Nomes de clientes já usados, sem repetir (ignora acento e maiúsculas), em ordem alfabética. */
export function clientSuggestions(...groups: string[][]): string[] {
  const seen = new Map<string, string>();
  for (const g of groups) for (const n of g) { const v = n.trim(); if (v && !seen.has(fold(v))) seen.set(fold(v), v); }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
}
