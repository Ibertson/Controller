"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { repo, useSnapshot } from "@/lib/data";
import { formatBRL, parseBRL } from "@/lib/money";
import type { Card } from "@/lib/types";
import { Button, Field, Input, inputClass } from "./ui";

export const CARD_BRANDS = ["Visa", "Mastercard", "Elo", "American Express", "Hipercard", "Outra"];

/** Cores do cartão: gradientes próprios, todos com texto branco legível. */
export const CARD_COLORS: Record<string, string> = {
  grafite: "linear-gradient(135deg, #1f2a30, #0d1417)",
  azul: "linear-gradient(135deg, #2f6fd6, #1d4f9e)",
  verde: "linear-gradient(135deg, #0b7a5e, #075140)",
  roxo: "linear-gradient(135deg, #7a3fc2, #52298a)",
  laranja: "linear-gradient(135deg, #c2611b, #8f4310)",
  vinho: "linear-gradient(135deg, #a3304a, #6e1d31)",
  petroleo: "linear-gradient(135deg, #1f6f80, #134a56)",
  mostarda: "linear-gradient(135deg, #a07a12, #6e530a)",
  coral: "linear-gradient(135deg, #c2453a, #8a2c24)",
  anil: "linear-gradient(135deg, #4b4fc9, #30338a)",
};
const COLOR_NAMES: Record<string, string> = {
  grafite: "Grafite", azul: "Azul", verde: "Verde", roxo: "Roxo", laranja: "Laranja",
  vinho: "Vinho", petroleo: "Petróleo", mostarda: "Mostarda", coral: "Coral", anil: "Anil",
};
export const cardBackground = (c: Pick<Card, "color">) => CARD_COLORS[c.color ?? ""] ?? CARD_COLORS.grafite;

export function CardModal({ card, onClose, onSaved }: { card?: Card; onClose: () => void; onSaved: (msg: string) => void }) {
  const snap = useSnapshot();
  const [form, setForm] = useState({
    name: card?.name ?? "", bank: card?.bank ?? "", last4: card?.last4 ?? "", brand: card?.brand ?? "",
    limit: card ? formatBRL(card.limitCents).replace(/^R\$\s?/, "") : "",
    closing: card ? String(card.closingDay) : "", due: card ? String(card.dueDay) : "",
    color: card?.color ?? "grafite", accountId: card?.paymentAccountId ?? "", personId: card?.personId ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => { nameRef.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
      if (e.key === "Tab" && dialogRef.current) {
        const f = dialogRef.current.querySelectorAll<HTMLElement>("button, input, select, [tabindex]:not([tabindex='-1'])");
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const day = (v: string) => { const n = Number(v); return Number.isInteger(n) && n >= 1 && n <= 31 ? n : null; };

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    const limit = form.limit.trim() ? parseBRL(form.limit) : 0;
    if (!form.name.trim()) errs.name = "Dê um nome para o cartão.";
    if (!form.bank.trim()) errs.bank = "Informe o banco.";
    if (form.last4 && !/^\d{4}$/.test(form.last4)) errs.last4 = "Use os 4 últimos números.";
    if (!form.brand) errs.brand = "Escolha a bandeira.";
    if (limit == null || limit < 0) errs.limit = "Valor inválido.";
    if (!day(form.closing)) errs.closing = "Dia de 1 a 31.";
    if (!day(form.due)) errs.due = "Dia de 1 a 31.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      await repo.upsertCard({
        id: card?.id, name: form.name.trim(), bank: form.bank.trim(), last4: form.last4 || null, brand: form.brand,
        limitCents: limit ?? 0, closingDay: day(form.closing)!, dueDay: day(form.due)!, color: form.color,
        paymentAccountId: form.accountId || null, personId: form.personId || null, archived: card?.archived ?? false,
      });
      onSaved(card ? "Cartão atualizado" : "Cartão criado");
      onClose();
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : "Não foi possível salvar." });
    } finally {
      setSaving(false);
    }
  }

  const accounts = snap?.accounts.filter((a) => !a.archived) ?? [];
  const people = snap?.people.filter((p) => !p.archived) ?? [];
  const invalid = (k: string) => ({ "aria-invalid": !!errors[k] || undefined, "aria-describedby": errors[k] ? `card-${k}-error` : undefined });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-center">
      <button aria-label="Fechar" tabIndex={-1} className="absolute inset-0 bg-text/40" onClick={onClose} />
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="card-title"
        className="relative flex max-h-dvh w-full flex-col overflow-y-auto rounded-t-lg bg-bg shadow-pop lg:w-[520px] lg:rounded-lg">
        <form onSubmit={submit} noValidate className="flex flex-col gap-4 p-5">
          <div className="flex items-center justify-between">
            <h2 id="card-title" className="text-lg font-semibold">{card ? "Editar cartão" : "Novo cartão"}</h2>
            <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-sm p-2 hover:bg-surface"><X className="size-5" /></button>
          </div>

          <Field label="Nome *" htmlFor="card-name" error={errors.name}>
            <Input id="card-name" ref={nameRef} value={form.name} onChange={(e) => set("name")(e.target.value)} placeholder="Ex.: Cartão do dia a dia" {...invalid("name")} />
          </Field>
          <Field label="Banco *" htmlFor="card-bank" error={errors.bank}>
            <Input id="card-bank" value={form.bank} onChange={(e) => set("bank")(e.target.value)} placeholder="Ex.: Banco do Brasil" {...invalid("bank")} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Últimos 4 dígitos" htmlFor="card-last4" error={errors.last4}>
              <Input id="card-last4" inputMode="numeric" maxLength={4} value={form.last4}
                onChange={(e) => set("last4")(e.target.value.replace(/\D/g, ""))} placeholder="0000" className="num" {...invalid("last4")} />
            </Field>
            <Field label="Bandeira *" htmlFor="card-brand" error={errors.brand}>
              <select id="card-brand" className={inputClass} value={form.brand} onChange={(e) => set("brand")(e.target.value)} {...invalid("brand")}>
                <option value="">Escolha</option>
                {CARD_BRANDS.map((b) => <option key={b}>{b}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Limite" htmlFor="card-limit" error={errors.limit}>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">R$</span>
              <Input id="card-limit" inputMode="decimal" value={form.limit} onChange={(e) => set("limit")(e.target.value)}
                placeholder="0,00" className="num pl-10" {...invalid("limit")} />
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Dia do fechamento *" htmlFor="card-closing" error={errors.closing}>
              <Input id="card-closing" type="number" min={1} max={31} inputMode="numeric" value={form.closing}
                onChange={(e) => set("closing")(e.target.value)} placeholder="Ex.: 5" {...invalid("closing")} />
            </Field>
            <Field label="Dia do vencimento *" htmlFor="card-due" error={errors.due}>
              <Input id="card-due" type="number" min={1} max={31} inputMode="numeric" value={form.due}
                onChange={(e) => set("due")(e.target.value)} placeholder="Ex.: 12" {...invalid("due")} />
            </Field>
          </div>

          <fieldset>
            <legend className="mb-1.5 text-xs font-semibold text-text-muted">Cor do cartão</legend>
            <div role="radiogroup" aria-label="Cor do cartão" className="grid grid-cols-5 gap-2">
              {Object.entries(CARD_COLORS).map(([key, bg]) => (
                <button key={key} type="button" role="radio" aria-checked={form.color === key} aria-label={COLOR_NAMES[key]}
                  onClick={() => set("color")(key)} style={{ background: bg }}
                  className="h-10 rounded-md ring-offset-2 ring-offset-bg aria-checked:ring-2 aria-checked:ring-accent" />
              ))}
            </div>
          </fieldset>

          <Field label="Conta para pagar a fatura (opcional)" htmlFor="card-account">
            <select id="card-account" className={inputClass} value={form.accountId} onChange={(e) => set("accountId")(e.target.value)}>
              <option value="">Nenhuma</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
          <Field label="Pessoa vinculada (opcional)" htmlFor="card-person" hint="As compras deste cartão já vêm marcadas para essa pessoa.">
            <select id="card-person" className={inputClass} value={form.personId} onChange={(e) => set("personId")(e.target.value)}>
              <option value="">Nenhuma</option>
              {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>

          {errors.form && <p role="alert" className="text-sm text-danger">{errors.form}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button type="submit" loading={saving}>{card ? "Salvar" : "Criar cartão"}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
