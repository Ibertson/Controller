"use client";

import { useState, type FormEvent } from "react";
import { Trash2 } from "lucide-react";
import { repo } from "@/lib/data";
import { categoryOptions } from "@/lib/categories";
import { monthOf, today } from "@/lib/dates";
import { formatBRL, parseBRL } from "@/lib/money";
import type { Recurring, Snapshot } from "@/lib/types";
import { Dialog } from "./Dialog";
import { Button, Field, Input, inputClass } from "./ui";

/** Novo ou editar gasto fixo / receita fixa mensal. */
export function RecurringModal({ snap, kind, item, onClose, onSaved }: {
  snap: Snapshot; kind: Recurring["kind"]; item?: Recurring;
  onClose: () => void; onSaved: (msg: string) => void;
}) {
  const income = kind === "income";
  const accounts = snap.accounts.filter((a) => !a.archived);
  const [description, setDescription] = useState(item?.description ?? "");
  const [amount, setAmount] = useState(item ? formatBRL(item.amountCents).replace(/^R\$\s?/, "") : "");
  const [day, setDay] = useState(String(item?.day ?? Number(today().slice(8, 10))));
  const [categoryId, setCategoryId] = useState(item?.categoryId ?? "");
  const [accountId, setAccountId] = useState(item?.accountId ?? accounts[0]?.id ?? "");
  const [personId, setPersonId] = useState(item?.personId ?? "");
  const [start, setStart] = useState((item?.startMonth ?? monthOf(today())).slice(0, 7));
  const [active, setActive] = useState(item?.active ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const noun = income ? "receita fixa" : "gasto fixo";

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    const cents = parseBRL(amount);
    const d = Number(day);
    if (!description.trim()) errs.description = "Informe a descrição.";
    if (!cents) errs.amount = "Informe o valor, por exemplo 150,00.";
    if (!Number.isInteger(d) || d < 1 || d > 31) errs.day = "Use um dia de 1 a 31.";
    if (!/^\d{4}-\d{2}$/.test(start)) errs.start = "Escolha o mês.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      await repo.upsertRecurring({
        id: item?.id, kind, description: description.trim(), amountCents: cents!, day: d,
        categoryId: categoryId || null, accountId: accountId || null, personId: personId || null,
        startMonth: `${start}-01`, active,
      });
      onSaved(item ? "Alterações salvas" : income ? "Receita fixa criada" : "Gasto fixo criado");
      onClose();
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : "Não foi possível salvar." });
    } finally { setSaving(false); }
  }

  async function remove() {
    if (!item || !confirm(`Excluir ${noun} "${item.description}"? Os lançamentos já feitos continuam.`)) return;
    setSaving(true);
    try { await repo.deleteRecurring(item.id); onSaved(income ? "Receita fixa excluída" : "Gasto fixo excluído"); onClose(); }
    catch (err) { setErrors({ form: err instanceof Error ? err.message : "Não foi possível excluir." }); }
    finally { setSaving(false); }
  }

  const clear = (k: string) => setErrors((x) => ({ ...x, [k]: "" }));
  return (
    <Dialog onClose={onClose} title={<h2 className="text-lg font-semibold">{item ? `Editar ${noun}` : income ? "Nova receita fixa" : "Novo gasto fixo"}</h2>}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Field label="Descrição" htmlFor="rec-desc" error={errors.description}>
          <Input id="rec-desc" autoFocus value={description} maxLength={80} placeholder={income ? "Ex.: Salário, Aluguel recebido" : "Ex.: Aluguel, Internet, Academia"}
            onChange={(e) => { setDescription(e.target.value); clear("description"); }} aria-invalid={!!errors.description || undefined} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Valor mensal" htmlFor="rec-amount" error={errors.amount}>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">R$</span>
              <Input id="rec-amount" inputMode="decimal" className="num pl-10" placeholder="0,00" value={amount}
                onChange={(e) => { setAmount(e.target.value); clear("amount"); }} aria-invalid={!!errors.amount || undefined} />
            </div>
          </Field>
          <Field label={income ? "Dia de receber" : "Dia de vencimento"} htmlFor="rec-day" error={errors.day}>
            <Input id="rec-day" type="number" min={1} max={31} inputMode="numeric" value={day}
              onChange={(e) => { setDay(e.target.value); clear("day"); }} aria-invalid={!!errors.day || undefined} />
          </Field>
        </div>
        <Field label="Categoria" htmlFor="rec-cat">
          <select id="rec-cat" className={inputClass} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Sem categoria</option>
            {categoryOptions(snap.categories, kind).map(({ category: c, label }) => <option key={c.id} value={c.id}>{label}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={income ? "Conta que recebe" : "Conta que paga"} htmlFor="rec-acc">
            <select id="rec-acc" className={inputClass} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
          <Field label="Começa em" htmlFor="rec-start" error={errors.start}>
            <input id="rec-start" type="month" className={inputClass} value={start} onChange={(e) => { setStart(e.target.value); clear("start"); }} />
          </Field>
        </div>
        {snap.people.some((p) => !p.archived) && (
          <Field label="Pessoa (opcional)" htmlFor="rec-person">
            <select id="rec-person" className={inputClass} value={personId} onChange={(e) => setPersonId(e.target.value)}>
              <option value="">Eu</option>
              {snap.people.filter((p) => !p.archived).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
        )}
        {item && (
          <label className="flex items-center justify-between gap-3 text-sm font-semibold">
            Ativo
            <input type="checkbox" role="switch" checked={active} onChange={(e) => setActive(e.target.checked)}
              className="relative h-6 w-11 cursor-pointer appearance-none rounded-pill bg-border transition-colors before:absolute before:left-0.5 before:top-0.5 before:size-5 before:rounded-pill before:bg-bg before:shadow-card before:transition-transform checked:bg-accent checked:before:translate-x-5" />
          </label>
        )}
        {errors.form && <p role="alert" className="text-sm text-danger">{errors.form}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          {item && <Button type="button" variant="secondary" className="mr-auto !text-danger" onClick={remove} disabled={saving}><Trash2 aria-hidden className="size-4" />Excluir</Button>}
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={saving}>Salvar</Button>
        </div>
      </form>
    </Dialog>
  );
}
