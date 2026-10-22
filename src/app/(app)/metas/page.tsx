"use client";

import { useState } from "react";
import { CalendarDays, CircleCheck, Flag, Minus, Pencil, PiggyBank, Plus, RotateCcw, Trash2, Trophy, User } from "lucide-react";
import { useShell } from "@/components/AppShell";
import { ContributionModal, GoalArt, GoalForm } from "@/components/GoalModals";
import { Button, Card, EmptyState, PageTitle, Skeleton } from "@/components/ui";
import { repo, useSnapshot } from "@/lib/data";
import { today } from "@/lib/dates";
import { goalCategoryLabel, goalSummary, monthlyNeeded, savedByGoal } from "@/lib/goals";
import { formatBRL } from "@/lib/money";
import type { Goal } from "@/lib/types";

const fmtDate = (d: string) =>
  new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(d + "T00:00:00Z")).replace(/\./g, "");

export default function Metas() {
  const snap = useSnapshot();
  const { toast } = useShell();
  const [tab, setTab] = useState<"active" | "done">("active");
  const [form, setForm] = useState<null | { goal?: Goal }>(null);
  const [move, setMove] = useState<null | { goal: Goal; mode: "add" | "withdraw" }>(null);

  if (!snap) return <Skeleton className="h-64" />;
  const saved = savedByGoal(snap);
  const sum = goalSummary(snap);
  const list = (tab === "active" ? sum.active : sum.done).sort((a, b) => (a.targetDate ?? "9999").localeCompare(b.targetDate ?? "9999") || a.name.localeCompare(b.name, "pt-BR"));
  const person = (id: string | null) => snap.people.find((p) => p.id === id)?.name;

  async function setStatus(g: Goal, status: Goal["status"]) {
    await repo.upsertGoal({ ...g, status, completedAt: status === "done" ? new Date().toISOString() : null });
    toast(status === "done" ? `Meta "${g.name}" concluída` : `Meta "${g.name}" reaberta`, { label: "Desfazer", run: () => void repo.upsertGoal(g) });
  }
  async function remove(g: Goal) {
    if (!confirm(`Excluir a meta "${g.name}" e tudo o que foi guardado nela?`)) return;
    await repo.deleteGoal(g.id);
    toast("Meta excluída");
  }

  return (
    <div className="flex flex-col gap-6">
      <PageTitle actions={<Button onClick={() => setForm({})}><Plus aria-hidden className="size-4" />Adicionar Meta</Button>}>Minhas Metas</PageTitle>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-pill bg-income/15 text-income"><PiggyBank aria-hidden className="size-5" /></span>
          <div><p className="text-sm text-text-muted">Total economizado</p><p className="num text-2xl font-bold text-income">{formatBRL(sum.totalSavedCents)}</p></div>
        </Card>
        <Card className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-pill bg-accent-soft text-accent"><Flag aria-hidden className="size-5" /></span>
          <div><p className="text-sm text-text-muted">Metas ativas</p><p className="num text-2xl font-bold">{sum.active.length}</p></div>
        </Card>
        <Card className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-pill bg-surface text-text-muted"><Trophy aria-hidden className="size-5" /></span>
          <div><p className="text-sm text-text-muted">Concluídas</p><p className="num text-2xl font-bold">{sum.done.length}</p></div>
        </Card>
      </div>

      <div role="tablist" aria-label="Metas" className="grid grid-cols-2 gap-1 rounded-md bg-surface p-1 sm:w-80">
        {([["active", `Ativas (${sum.active.length})`], ["done", `Concluídas (${sum.done.length})`]] as const).map(([v, l]) => (
          <button key={v} type="button" role="tab" aria-selected={tab === v} onClick={() => setTab(v)}
            className="h-9 rounded-md text-sm font-semibold text-text-muted aria-selected:bg-surface-raised aria-selected:text-text aria-selected:shadow-card">{l}</button>
        ))}
      </div>

      {!list.length ? (
        <Card>
          <EmptyState icon={tab === "active" ? Flag : Trophy}
            title={tab === "active" ? "Nenhuma meta ativa. Para que você está guardando dinheiro?" : "Nenhuma meta concluída ainda."}
            action={tab === "active" ? <Button onClick={() => setForm({})}><Plus aria-hidden className="size-4" />Adicionar Meta</Button> : undefined} />
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((g) => {
            const v = Math.max(0, saved.get(g.id) ?? 0);
            const ratio = Math.min(1, v / g.targetCents);
            const need = g.status === "active" ? monthlyNeeded(g, v, today()) : null;
            const late = g.status === "active" && !!g.targetDate && g.targetDate < today() && v < g.targetCents;
            const color = g.color ?? "var(--color-accent)";
            return (
              <li key={g.id} className="flex flex-col overflow-hidden rounded-lg border border-border bg-surface-raised shadow-card">
                <div className="relative h-32" style={{ background: color }}>
                  <GoalArt image={g.image} color={g.color} position={g.imagePosition} className="absolute inset-0 size-full" iconClass="size-14" />
                  <span className="absolute left-3 top-3 rounded-pill bg-surface-raised/90 px-2.5 py-0.5 text-xs font-semibold">{goalCategoryLabel(g.category)}</span>
                  {g.status === "done" && <span className="absolute right-3 top-3 flex items-center gap-1 rounded-pill bg-income px-2.5 py-0.5 text-xs font-semibold text-white"><CircleCheck aria-hidden className="size-3.5" />Concluída</span>}
                </div>
                <div className="flex flex-1 flex-col gap-3 p-4">
                  <div>
                    <h2 className="truncate text-lg font-semibold">{g.name}</h2>
                    {g.description && <p className="line-clamp-2 text-sm text-text-muted">{g.description}</p>}
                  </div>
                  <div>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="num text-xl font-bold">{formatBRL(v)}</span>
                      <span className="num text-sm text-text-muted">de {formatBRL(g.targetCents)}</span>
                    </div>
                    <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(ratio * 100)} aria-label={`Progresso de ${g.name}`}
                      className="mt-1.5 h-2.5 overflow-hidden rounded-pill bg-surface">
                      <span className="block h-full rounded-pill" style={{ width: `${ratio * 100}%`, background: color }} />
                    </div>
                    <p className="mt-1 text-xs text-text-muted">{Math.round(ratio * 100)}% · {v >= g.targetCents ? "Meta atingida" : `Faltam ${formatBRL(g.targetCents - v)}`}</p>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
                    {g.targetDate && <span className={`flex items-center gap-1 ${late ? "text-expense" : ""}`}><CalendarDays aria-hidden className="size-3.5" />{late ? "Venceu em " : "Até "}{fmtDate(g.targetDate)}</span>}
                    {person(g.personId) && <span className="flex items-center gap-1"><User aria-hidden className="size-3.5" />{person(g.personId)}</span>}
                    {need && <span>Guarde {formatBRL(need)} por mês</span>}
                  </div>
                  <div className="mt-auto flex flex-wrap gap-2 border-t border-border pt-3">
                    {g.status === "active" ? (
                      <>
                        <Button size="sm" onClick={() => setMove({ goal: g, mode: "add" })}><Plus aria-hidden className="size-4" />Guardar</Button>
                        <Button size="sm" variant="secondary" disabled={!v} onClick={() => setMove({ goal: g, mode: "withdraw" })}><Minus aria-hidden className="size-4" />Retirar</Button>
                        <Button size="sm" variant="secondary" onClick={() => void setStatus(g, "done")}><CircleCheck aria-hidden className="size-4" />Concluir</Button>
                      </>
                    ) : (
                      <Button size="sm" variant="secondary" onClick={() => void setStatus(g, "active")}><RotateCcw aria-hidden className="size-4" />Reabrir</Button>
                    )}
                    <span className="ml-auto flex gap-1">
                      <button type="button" aria-label={`Editar ${g.name}`} title="Editar" onClick={() => setForm({ goal: g })}
                        className="grid size-8 place-items-center rounded-md text-text-muted hover:bg-surface hover:text-text"><Pencil aria-hidden className="size-4" /></button>
                      <button type="button" aria-label={`Excluir ${g.name}`} title="Excluir" onClick={() => void remove(g)}
                        className="grid size-8 place-items-center rounded-md text-text-muted hover:bg-surface hover:text-danger"><Trash2 aria-hidden className="size-4" /></button>
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {form && <GoalForm snap={snap} goal={form.goal} onClose={() => setForm(null)} onSaved={(m) => toast(m)} />}
      {move && (
        <ContributionModal goal={move.goal} mode={move.mode} savedCents={Math.max(0, saved.get(move.goal.id) ?? 0)} onClose={() => setMove(null)}
          onSaved={(m, reached) => {
            const g = move.goal;
            toast(reached ? `${m}. Meta atingida!` : m, reached ? { label: "Concluir", run: () => void setStatus(g, "done") } : undefined);
          }} />
      )}
    </div>
  );
}
