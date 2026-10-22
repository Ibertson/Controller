"use client";

import { MoreHorizontal } from "lucide-react";
import { repo } from "@/lib/data";
import { dayLabel } from "@/lib/dates";
import { formatBRL, formatSigned } from "@/lib/money";
import type { Snapshot, Transaction } from "@/lib/types";
import { CategoryIcon } from "./CategoryIcon";

function tone(t: Transaction) {
  return t.kind === "income" ? "income" : t.kind === "expense" ? "expense" : "neutral";
}

export function TransactionList({ snap, items, onDeleted }: { snap: Snapshot; items: Transaction[]; onDeleted?: (msg: string) => void }) {
  const byId = <T extends { id: string }>(list: T[], id: string | null) => (id ? list.find((x) => x.id === id) : undefined);
  const groups = new Map<string, Transaction[]>();
  for (const t of [...items].sort((a, b) => b.occurredOn.localeCompare(a.occurredOn) || b.createdAt.localeCompare(a.createdAt))) {
    groups.set(t.occurredOn, [...(groups.get(t.occurredOn) ?? []), t]);
  }

  async function remove(t: Transaction) {
    let scope: "one" | "future" | "all" = "one";
    if (t.installmentGroupId) {
      const answer = prompt("Mover para a lixeira: 1 = só esta parcela, 2 = esta e as próximas, 3 = todas", "1");
      if (!answer) return;
      scope = answer === "3" ? "all" : answer === "2" ? "future" : "one";
    } else if (!confirm("Excluir este lançamento? Ele vai para a lixeira.")) return;
    await repo.deleteTransaction(t.id, scope);
    onDeleted?.("Lançamento movido para a lixeira");
  }

  return (
    <div>
      {[...groups].map(([day, list]) => (
        <div key={day}>
          <h3 className="mb-1 mt-3 text-xs font-semibold text-text-muted first:mt-0">{dayLabel(day)}</h3>
          <ul>
            {list.map((t) => {
              const cat = byId(snap.categories, t.categoryId);
              const where = t.kind === "transfer"
                ? `${byId(snap.accounts, t.accountId)?.name ?? "?"} → ${byId(snap.accounts, t.toAccountId)?.name ?? "?"}`
                : byId(snap.cards, t.cardId)?.name ?? byId(snap.accounts, t.accountId)?.name;
              const person = byId(snap.people, t.personId)?.name;
              const title = t.description || cat?.name || (t.kind === "transfer" ? "Transferência" : "Sem descrição");
              return (
                <li key={t.id} className="group flex items-center gap-3 border-b border-border py-2.5 last:border-0">
                  <CategoryIcon name={t.kind === "transfer" ? "transfer" : cat?.icon} color={t.kind === "transfer" ? null : cat?.color} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate">{title}</span>
                      {t.installmentTotal && <span className="shrink-0 rounded-pill border border-border bg-surface px-1.5 text-[11px] text-text-muted">{t.installmentNumber}/{t.installmentTotal}</span>}
                      {!t.isPaid && <span className="shrink-0 rounded-pill bg-warning-soft px-1.5 text-[11px] font-medium text-warning">{t.kind === "income" ? "A receber" : "A pagar"}</span>}
                    </div>
                    <div className="truncate text-xs text-text-muted">{[where, person].filter(Boolean).join(" · ")}</div>
                  </div>
                  <span className={`num shrink-0 font-semibold ${tone(t) === "income" ? "text-income" : tone(t) === "expense" ? "text-expense" : "text-text"}`}>
                    {tone(t) === "neutral" ? formatBRL(t.amountCents) : formatSigned(t.amountCents, tone(t) as "income" | "expense")}
                  </span>
                  <button aria-label={`Excluir ${title}`} onClick={() => remove(t)} className="rounded-sm p-1 text-text-muted hover:bg-surface">
                    <MoreHorizontal className="size-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
