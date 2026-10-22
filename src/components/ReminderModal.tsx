"use client";

import { useState, type FormEvent } from "react";
import { repo } from "@/lib/data";
import { today } from "@/lib/dates";
import { REMINDER_TYPES, REPEAT_OPTIONS, formatWhatsapp, normalizeWhatsapp } from "@/lib/reminders";
import type { Reminder, ReminderType, Snapshot } from "@/lib/types";
import { Dialog } from "./Dialog";
import { Button, Field, Input, inputClass } from "./ui";

const LAST_WA = "sobra:last-whatsapp";

/** Adicionar ou editar um lembrete. */
export function ReminderModal({ snap, item, onClose, onSaved }: {
  snap: Snapshot; item?: Reminder; onClose: () => void; onSaved: (msg: string) => void;
}) {
  const [title, setTitle] = useState(item?.title ?? "");
  const [type, setType] = useState<ReminderType>(item?.type ?? "casa");
  const [dueOn, setDueOn] = useState(item?.dueOn ?? today());
  const [repeat, setRepeat] = useState<Reminder["repeatDays"]>(item?.repeatDays ?? 0);
  const [personId, setPersonId] = useState(item?.personId ?? "");
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [whatsapp, setWhatsapp] = useState(() => {
    if (item) return item.whatsapp ? formatWhatsapp(item.whatsapp) : "";
    try { return localStorage.getItem(LAST_WA) ?? ""; } catch { return ""; }
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const clear = (k: string) => setErrors((x) => ({ ...x, [k]: "" }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!title.trim()) errs.title = "Informe o título do lembrete.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueOn)) errs.dueOn = "Escolha a data.";
    const wa = whatsapp.trim() ? normalizeWhatsapp(whatsapp) : null;
    if (whatsapp.trim() && !wa) errs.whatsapp = "Número inválido. Use DDD + número, ex: (11) 99999-9999.";
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) return;
    setSaving(true);
    try {
      await repo.upsertReminder({
        id: item?.id, title: title.trim(), type, dueOn, repeatDays: repeat, personId: personId || null, notes: notes.trim(), whatsapp: wa,
        doneAt: item?.doneAt ?? null, lastDoneOn: item?.lastDoneOn ?? null,
      });
      if (wa) try { localStorage.setItem(LAST_WA, formatWhatsapp(wa)); } catch { /* sem armazenamento */ }
      onSaved(item ? "Lembrete atualizado" : "Lembrete adicionado");
      onClose();
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : "Não foi possível salvar." });
    } finally { setSaving(false); }
  }

  return (
    <Dialog onClose={onClose} title={<h2 className="text-lg font-semibold">{item ? "Editar Lembrete" : "Adicionar Lembrete"}</h2>}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Field label="Título" htmlFor="rem-title" error={errors.title}>
          <Input id="rem-title" autoFocus maxLength={80} placeholder="Ex: Troca de óleo do carro" value={title}
            onChange={(e) => { setTitle(e.target.value); clear("title"); }} aria-invalid={!!errors.title || undefined} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tipo" htmlFor="rem-type">
            <select id="rem-type" className={inputClass} value={type} onChange={(e) => setType(e.target.value as ReminderType)}>
              {REMINDER_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          <Field label="Data" htmlFor="rem-date" error={errors.dueOn}>
            <input id="rem-date" type="date" className={inputClass} value={dueOn} onChange={(e) => { setDueOn(e.target.value); clear("dueOn"); }} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Repetir" htmlFor="rem-repeat">
            <select id="rem-repeat" className={inputClass} value={repeat} onChange={(e) => setRepeat(Number(e.target.value) as Reminder["repeatDays"])}>
              {REPEAT_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          <Field label="Pessoa a avisar (opcional)" htmlFor="rem-person">
            <select id="rem-person" className={inputClass} value={personId} onChange={(e) => setPersonId(e.target.value)}>
              <option value="">Conta principal</option>
              {snap.people.filter((p) => !p.archived).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
        </div>
        <Field label="WhatsApp para avisar (opcional)" htmlFor="rem-wa" error={errors.whatsapp}>
          <Input id="rem-wa" type="tel" inputMode="tel" autoComplete="tel" maxLength={20} placeholder="(11) 99999-9999" value={whatsapp}
            onChange={(e) => { setWhatsapp(e.target.value); clear("whatsapp"); }} aria-invalid={!!errors.whatsapp || undefined} />
        </Field>
        <Field label="Observações" htmlFor="rem-notes">
          <textarea id="rem-notes" rows={3} maxLength={500} className={`${inputClass} h-auto min-h-24 py-2.5`} placeholder="Anotações sobre o lembrete..."
            value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        {errors.form && <p role="alert" className="text-sm text-danger">{errors.form}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={saving}>{item ? "Salvar" : "Adicionar Lembrete"}</Button>
        </div>
      </form>
    </Dialog>
  );
}
