"use client";

import { useState } from "react";
import { Bell, Bike, Car, CircleCheck, Hammer, House, MessageCircle, Pencil, Plus, Repeat, RotateCcw, Trash2, User, Wrench, type LucideIcon } from "lucide-react";
import { useShell } from "@/components/AppShell";
import { ReminderModal } from "@/components/ReminderModal";
import { Button, Card, Skeleton } from "@/components/ui";
import { repo, useSnapshot } from "@/lib/data";
import { today } from "@/lib/dates";
import { completeReminder, dueStatus, formatWhatsapp, reminderMessage, reminderTypeLabel, repeatLabel, whatsappLink } from "@/lib/reminders";
import type { Reminder, ReminderType } from "@/lib/types";

const TYPE_ICON: Record<ReminderType, LucideIcon> = { casa: House, reforma: Hammer, manutencao: Wrench, carro: Car, moto: Bike, outro: Bell };
const TONE = { late: "bg-expense/10 text-expense", today: "bg-warning/15 text-warning", soon: "bg-accent/10 text-accent", later: "bg-surface text-text-muted" };
const fmtDate = (d: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(d + "T00:00:00Z"));

export default function Lembretes() {
  const snap = useSnapshot();
  const { toast } = useShell();
  const [tab, setTab] = useState<"active" | "done">("active");
  const [form, setForm] = useState<null | { item?: Reminder }>(null);

  if (!snap) return <Skeleton className="h-64" />;
  const all = snap.reminders ?? [];
  const active = all.filter((r) => !r.doneAt).sort((a, b) => a.dueOn.localeCompare(b.dueOn) || a.title.localeCompare(b.title, "pt-BR"));
  const done = all.filter((r) => r.doneAt).sort((a, b) => (b.doneAt ?? "").localeCompare(a.doneAt ?? ""));
  const list = tab === "active" ? active : done;
  const now = today();
  const late = active.filter((r) => r.dueOn < now).length;
  const person = (id: string | null) => (id ? snap.people.find((p) => p.id === id)?.name : null) ?? "Conta principal";

  async function complete(r: Reminder) {
    const next = completeReminder(r, now, new Date().toISOString());
    await repo.upsertReminder(next);
    toast(r.repeatDays ? `Feito! Próximo em ${fmtDate(next.dueOn)}` : "Lembrete concluído", { label: "Desfazer", run: () => void repo.upsertReminder(r) });
  }
  async function reopen(r: Reminder) {
    await repo.upsertReminder({ ...r, doneAt: null });
    toast("Lembrete reaberto");
  }
  async function remove(r: Reminder) {
    if (!confirm(`Excluir o lembrete "${r.title}"?`)) return;
    await repo.deleteReminder(r.id);
    toast("Lembrete excluído", { label: "Desfazer", run: () => void repo.upsertReminder(r) });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Lembretes</h1>
          <p className="text-sm text-text-muted">Crie lembretes de casa, carro, moto e reforma e veja o que está para vencer</p>
        </div>
        <Button onClick={() => setForm({})}><Plus aria-hidden className="size-4" />Novo Lembrete</Button>
      </div>

      <div role="tablist" aria-label="Lembretes" className="mx-auto grid grid-cols-2 gap-1 rounded-md bg-surface p-1 sm:w-72">
        {([["active", `Ativos (${active.length})`], ["done", `Concluídos (${done.length})`]] as const).map(([v, l]) => (
          <button key={v} type="button" role="tab" aria-selected={tab === v} onClick={() => setTab(v)}
            className="h-8 rounded-md px-3 text-sm font-medium text-text-muted aria-selected:bg-surface-raised aria-selected:text-text aria-selected:shadow-card">{l}</button>
        ))}
      </div>

      {tab === "active" && late > 0 && (
        <p role="status" className="rounded-md bg-expense/10 px-4 py-3 text-sm font-medium text-expense">
          {late === 1 ? "1 lembrete está vencido." : `${late} lembretes estão vencidos.`}
        </p>
      )}

      {!list.length ? (
        <Card className="flex flex-col items-center gap-1 py-12 text-center">
          <Bell aria-hidden className="size-12 text-text-muted" strokeWidth={1.5} />
          <p className="mt-2 font-semibold">{tab === "active" ? "Nenhum lembrete ativo" : "Nenhum lembrete concluído"}</p>
          <p className="text-sm text-text-muted">{tab === "active"
            ? "Adicione lembretes de casa, carro, moto ou reforma para não esquecer as manutenções."
            : "Os lembretes que não se repetem vêm para cá quando você os conclui."}</p>
        </Card>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {list.map((r) => {
            const Icon = TYPE_ICON[r.type];
            const st = dueStatus(r.dueOn, now);
            return (
              <li key={r.id} className="flex gap-3 rounded-lg border border-border bg-surface-raised p-4 shadow-card">
                <span className="grid size-11 shrink-0 place-items-center rounded-pill bg-accent/10 text-accent"><Icon aria-hidden className="size-5" /></span>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="truncate font-semibold">{r.title}</h2>
                      <p className="text-xs text-text-muted">{reminderTypeLabel(r.type)} · {fmtDate(r.dueOn)}</p>
                    </div>
                    {r.doneAt
                      ? <span className="flex shrink-0 items-center gap-1 rounded-pill bg-income px-2 py-0.5 text-xs font-semibold text-white"><CircleCheck aria-hidden className="size-3.5" />Concluído</span>
                      : <span className={`shrink-0 rounded-pill px-2 py-0.5 text-xs font-semibold ${TONE[st.tone]}`}>{st.label}</span>}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
                    {r.repeatDays > 0 && <span className="flex items-center gap-1"><Repeat aria-hidden className="size-3.5" />{repeatLabel(r.repeatDays)}</span>}
                    <span className="flex items-center gap-1"><User aria-hidden className="size-3.5" />{person(r.personId)}</span>
                    {r.whatsapp && <span className="flex items-center gap-1"><MessageCircle aria-hidden className="size-3.5" />{formatWhatsapp(r.whatsapp)}</span>}
                    {r.lastDoneOn && <span>Feito em {fmtDate(r.lastDoneOn)}</span>}
                  </div>
                  {r.notes && <p className="line-clamp-2 text-sm text-text-muted">{r.notes}</p>}
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {r.doneAt
                      ? <Button size="sm" variant="secondary" onClick={() => void reopen(r)}><RotateCcw aria-hidden className="size-4" />Reabrir</Button>
                      : <Button size="sm" onClick={() => void complete(r)}><CircleCheck aria-hidden className="size-4" />{r.repeatDays ? "Feito" : "Concluir"}</Button>}
                    {!r.doneAt && (
                      <a href={whatsappLink(reminderMessage(r, now), r.whatsapp)} target="_blank" rel="noopener noreferrer"
                        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium hover:bg-surface">
                        <MessageCircle aria-hidden className="size-4" />Enviar no WhatsApp
                      </a>
                    )}
                    <span className="ml-auto flex gap-1">
                      <button type="button" aria-label={`Editar ${r.title}`} title="Editar" onClick={() => setForm({ item: r })}
                        className="grid size-8 place-items-center rounded-md text-text-muted hover:bg-surface hover:text-text"><Pencil aria-hidden className="size-4" /></button>
                      <button type="button" aria-label={`Excluir ${r.title}`} title="Excluir" onClick={() => void remove(r)}
                        className="grid size-8 place-items-center rounded-md text-text-muted hover:bg-surface hover:text-danger"><Trash2 aria-hidden className="size-4" /></button>
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {form && <ReminderModal snap={snap} item={form.item} onClose={() => setForm(null)} onSaved={(m) => toast(m)} />}
    </div>
  );
}
