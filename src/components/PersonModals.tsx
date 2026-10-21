"use client";

import { useState, type FormEvent } from "react";
import { Receipt } from "lucide-react";
import { Dialog } from "./Dialog";
import { repo } from "@/lib/data";
import { formatBRL, parseBRL } from "@/lib/money";
import { monthLabel } from "@/lib/dates";
import { monthTransactions } from "@/lib/summary";
import type { Person, Snapshot } from "@/lib/types";
import { TransactionList } from "./TransactionList";
import { Button, Field, Input } from "./ui";

export const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";

/** Lançamentos do mês de uma pessoa ("" = titular, lançamentos sem pessoa). */
export function PersonView({ snap, person, month, side, onClose, onDeleted }:
  { snap: Snapshot; person: { id: string; name: string }; month: string; side: "expense" | "income"; onClose: () => void; onDeleted: (msg: string) => void }) {
  const items = monthTransactions(snap, month).filter((t) => t.kind === side && (t.personId ?? "") === person.id);
  const total = items.reduce((a, t) => a + t.amountCents, 0);
  return (
    <Dialog onClose={onClose} title={
      <div className="flex items-center gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-pill bg-accent font-semibold text-on-accent">{initials(person.name)}</span>
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold">{person.name}</h2>
          <p className="text-sm text-text-muted">
            {side === "expense" ? "Gastos" : "Receitas"} em {monthLabel(month)}:{" "}
            <span className={`num font-semibold ${side === "expense" ? "text-expense" : "text-income"}`}>{formatBRL(total)}</span>
          </p>
        </div>
      </div>
    }>
      {items.length ? <TransactionList snap={snap} items={items} onDeleted={onDeleted} /> : (
        <div className="flex flex-col items-center gap-3 py-10 text-center text-text-muted">
          <Receipt aria-hidden className="size-10" />
          <p>{person.name} não tem {side === "expense" ? "gastos" : "receitas"} neste mês.</p>
        </div>
      )}
      <div className="mt-4 flex justify-end"><Button variant="secondary" onClick={onClose}>Fechar</Button></div>
    </Dialog>
  );
}

/** Edita uma pessoa cadastrada ou, sem `person.workspaceId`, o nome do titular. */
export function PersonEdit({ person, onClose, onSaved }: { person: Person | { id: ""; name: string }; onClose: () => void; onSaved: (msg: string) => void }) {
  const self = !("workspaceId" in person);
  const [name, setName] = useState(person.name);
  const [limit, setLimit] = useState(!self && person.monthlyLimitCents ? formatBRL(person.monthlyLimitCents).replace(/^R\$\s?/, "") : "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const cents = limit.trim() ? parseBRL(limit) : null;
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Informe o nome.";
    if (limit.trim() && cents == null) errs.limit = "Valor inválido.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      if (self) await repo.renameSelf(name.trim());
      else await repo.upsertPerson({ id: person.id, name: name.trim(), monthlyLimitCents: cents || null, archived: person.archived });
      onSaved(self ? "Nome atualizado" : "Pessoa atualizada");
      onClose();
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : "Não foi possível salvar." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog onClose={onClose} title={<h2 className="text-lg font-semibold">{self ? "Editar seu nome" : "Editar pessoa"}</h2>}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Field label="Nome *" htmlFor="p-name" error={errors.name}>
          <Input id="p-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!errors.name || undefined} />
        </Field>
        {!self && <Field label="Limite de gastos por mês (opcional)" htmlFor="p-limit" error={errors.limit} hint="Aparece em Pessoas como barra de uso.">
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">R$</span>
            <Input id="p-limit" inputMode="decimal" value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="0,00" className="num pl-10" />
          </div>
        </Field>}
        {errors.form && <p role="alert" className="text-sm text-danger">{errors.form}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={saving}>Salvar</Button>
        </div>
      </form>
    </Dialog>
  );
}
