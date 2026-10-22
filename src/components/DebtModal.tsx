"use client";

import { useState, type FormEvent } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { repo } from "@/lib/data";
import { today } from "@/lib/dates";
import { DEBT_CATEGORIES, DEBT_TYPES, EXTRA_FREQUENCIES } from "@/lib/debts";
import { formatBRL, parseBRL } from "@/lib/money";
import type { Debt, DebtExtraCost, DebtType, Snapshot } from "@/lib/types";
import { Dialog } from "./Dialog";
import { Button, Field, Input, inputClass } from "./ui";

const centsText = (c: number | null | undefined) => (c ? formatBRL(c).replace(/^R\$\s?/, "") : "");
const pctText = (n: number | null | undefined) => (n == null ? "" : n.toFixed(2).replace(".", ","));
const parsePct = (s: string) => (s.trim() ? Number(s.replace(/\./g, "").replace(",", ".")) : null);
const textareaClass = `${inputClass} h-auto min-h-24 py-2.5`;

function MoneyInput({ id, value, onChange, invalid, placeholder = "0,00" }: { id: string; value: string; onChange: (v: string) => void; invalid?: boolean; placeholder?: string }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">R$</span>
      <Input id={id} inputMode="decimal" className="num pl-10" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={invalid || undefined} />
    </div>
  );
}

/** Número com botões − e +. */
function Stepper({ id, value, onChange, min, max, label }: { id: string; value: string; onChange: (v: string) => void; min: number; max: number; label: string }) {
  const n = Number(value) || 0;
  const set = (v: number) => onChange(String(Math.min(max, Math.max(min, v))));
  const btn = "grid size-11 shrink-0 place-items-center rounded-md border border-border-input bg-bg text-text hover:bg-surface disabled:opacity-40";
  return (
    <div className="flex gap-2">
      <button type="button" className={btn} aria-label={`Diminuir ${label}`} disabled={n <= min} onClick={() => set(n - 1)}><Minus aria-hidden className="size-4" /></button>
      <Input id={id} type="number" inputMode="numeric" min={min} max={max} className="num text-center" value={value} onChange={(e) => onChange(e.target.value)} />
      <button type="button" className={btn} aria-label={`Aumentar ${label}`} disabled={n >= max} onClick={() => set(n + 1)}><Plus aria-hidden className="size-4" /></button>
    </div>
  );
}

/** Valor do titular no select de responsável. */
const SELF = "self";

interface ExtraRow { name: string; amount: string; frequency: DebtExtraCost["frequency"]; }

/** Adicionar ou editar uma dívida parcelada. */
export function DebtModal({ snap, debt, selfName, defaultType = "financiamento", onClose, onSaved }: {
  snap: Snapshot; debt?: Debt; selfName: string; defaultType?: DebtType; onClose: () => void; onSaved: (msg: string) => void;
}) {
  const [name, setName] = useState(debt?.name ?? "");
  const [creditor, setCreditor] = useState(debt?.creditor ?? "");
  const [type, setType] = useState<DebtType>(debt?.type ?? defaultType);
  const [total, setTotal] = useState(centsText(debt?.totalCents));
  const [installment, setInstallment] = useState(centsText(debt?.installmentCents));
  // O último valor digitado (total ou parcela) manda; o outro é calculado.
  const [lead, setLead] = useState<"total" | "installment">("total");
  const [count, setCount] = useState(String(debt?.installmentsTotal ?? 1));
  const [paid, setPaid] = useState(String(debt?.installmentsPaid ?? 0));
  const [start, setStart] = useState(debt?.startOn ?? today());
  const [dueDay, setDueDay] = useState(String(debt?.dueDay ?? 10));
  const [rate, setRate] = useState(pctText(debt?.interestRate ?? 0));
  const [category, setCategory] = useState(debt?.category ?? "");
  const [personId, setPersonId] = useState(debt?.selfResponsible ? SELF : debt?.personId ?? "");
  const [asset, setAsset] = useState(debt?.assetDescription ?? "");
  const [commission, setCommission] = useState(centsText(debt?.commissionCents));
  const [commissionPct, setCommissionPct] = useState(pctText(debt?.commissionPct ?? 5));
  const [seller, setSeller] = useState(debt?.seller ?? "");
  const [assetFinal, setAssetFinal] = useState(centsText(debt?.assetFinalCents));
  const [months, setMonths] = useState(String(debt?.monthsToReady ?? 0));
  const [extras, setExtras] = useState<ExtraRow[]>(debt?.extraCosts.map((c) => ({ name: c.name, amount: centsText(c.amountCents), frequency: c.frequency })) ?? []);
  const [notes, setNotes] = useState(debt?.notes ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const clear = (k: string) => setErrors((x) => ({ ...x, [k]: "" }));
  const financing = type === "financiamento";
  const people = snap.people.filter((p) => !p.archived);

  /** Recalcula o valor que não foi digitado por último. */
  function sync(next: { total?: string; installment?: string; count?: string; lead?: "total" | "installment" }) {
    const l = next.lead ?? lead;
    const n = Number(next.count ?? count) || 0;
    const t = parseBRL(next.total ?? total), p = parseBRL(next.installment ?? installment);
    if (l === "total" && t && n > 0) setInstallment(centsText(Math.round(t / n)));
    if (l === "installment" && p && n > 0) setTotal(centsText(p * n));
    if (l === "total" && t) syncCommission(commissionPct, t);
  }
  function syncCommission(pctStr: string, totalCents = parseBRL(total)) {
    const pct = parsePct(pctStr);
    if (pct != null && Number.isFinite(pct) && totalCents) setCommission(centsText(Math.round((totalCents * pct) / 100)));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    const n = Number(count), p = Number(paid), d = Number(dueDay), m = Number(months);
    let totalCents = parseBRL(total), instCents = parseBRL(installment);
    if (!totalCents && instCents && n > 0) totalCents = instCents * n;
    if (!instCents && totalCents && n > 0) instCents = Math.round(totalCents / n);
    const rateNum = parsePct(rate), pctNum = parsePct(commissionPct);
    if (!name.trim()) errs.name = "Informe o nome da dívida.";
    if (!totalCents || !instCents) errs.total = "Informe o valor total ou o valor da parcela.";
    if (!Number.isInteger(n) || n < 1 || n > 999) errs.count = "Use de 1 a 999 parcelas.";
    if (!Number.isInteger(p) || p < 0 || p > n) errs.paid = "Não pode passar do total de parcelas.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) errs.start = "Escolha a data de início.";
    if (!Number.isInteger(d) || d < 1 || d > 31) errs.dueDay = "Use um dia de 1 a 31.";
    if (rateNum != null && (!Number.isFinite(rateNum) || rateNum < 0 || rateNum > 1000)) errs.rate = "Use um número, por exemplo 1,99.";
    if (financing) {
      if (pctNum != null && (!Number.isFinite(pctNum) || pctNum < 0 || pctNum > 100)) errs.commissionPct = "Use de 0 a 100.";
      if (!Number.isInteger(m) || m < 0 || m > 600) errs.months = "Use de 0 a 600 meses.";
      if (extras.some((x) => x.name.trim() && !parseBRL(x.amount))) errs.extras = "Informe o valor de cada custo extra.";
    }
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) return;
    setSaving(true);
    try {
      await repo.upsertDebt({
        id: debt?.id, name: name.trim(), creditor: creditor.trim(), type,
        totalCents: totalCents!, installmentCents: instCents!, installmentsTotal: n, installmentsPaid: p,
        startOn: start, dueDay: d, interestRate: rateNum ? Math.round(rateNum * 100) / 100 : null,
        category: category || null, personId: personId && personId !== SELF ? personId : null, selfResponsible: personId === SELF,
        assetDescription: financing ? asset.trim() : "", commissionCents: financing ? parseBRL(commission) ?? 0 : 0,
        commissionPct: financing && pctNum != null ? Math.round(pctNum * 100) / 100 : null, seller: financing ? seller.trim() : "",
        assetFinalCents: financing ? parseBRL(assetFinal) || null : null, monthsToReady: financing && m ? m : null,
        extraCosts: financing ? extras.filter((x) => x.name.trim()).map((x) => ({ name: x.name.trim(), amountCents: parseBRL(x.amount)!, frequency: x.frequency })) : [],
        notes: notes.trim(),
      });
      onSaved(debt ? "Dívida atualizada" : "Dívida adicionada");
      onClose();
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : "Não foi possível salvar." });
    } finally { setSaving(false); }
  }

  const setExtra = (i: number, patch: Partial<ExtraRow>) => setExtras((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <Dialog onClose={onClose} title={<h2 className="text-lg font-semibold">{debt ? "Editar Dívida" : "Adicionar Nova Dívida"}</h2>}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Field label="Nome da Dívida" htmlFor="debt-name" error={errors.name}>
          <Input id="debt-name" autoFocus maxLength={80} placeholder="Ex: Financiamento Apartamento" value={name}
            onChange={(e) => { setName(e.target.value); clear("name"); }} aria-invalid={!!errors.name || undefined} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Credor" htmlFor="debt-creditor">
            <Input id="debt-creditor" maxLength={80} placeholder="Ex: Banco Itaú" value={creditor} onChange={(e) => setCreditor(e.target.value)} />
          </Field>
          <Field label="Tipo de Dívida" htmlFor="debt-type">
            <select id="debt-type" className={inputClass} value={type} onChange={(e) => setType(e.target.value as DebtType)}>
              {DEBT_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Valor Total da Dívida" htmlFor="debt-total" error={errors.total}>
            <MoneyInput id="debt-total" value={total} invalid={!!errors.total}
              onChange={(v) => { setTotal(v); setLead("total"); clear("total"); sync({ total: v, lead: "total" }); }} />
          </Field>
          <Field label="Valor da Parcela" htmlFor="debt-installment">
            <MoneyInput id="debt-installment" value={installment}
              onChange={(v) => { setInstallment(v); setLead("installment"); clear("total"); sync({ installment: v, lead: "installment" }); }} />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nº Total de Parcelas" htmlFor="debt-count" error={errors.count}>
            <Stepper id="debt-count" label="parcelas" min={1} max={999} value={count} onChange={(v) => { setCount(v); clear("count"); sync({ count: v }); }} />
          </Field>
          <Field label="Parcelas Já Pagas" htmlFor="debt-paid" error={errors.paid}>
            <Stepper id="debt-paid" label="parcelas pagas" min={0} max={Number(count) || 0} value={paid} onChange={(v) => { setPaid(v); clear("paid"); }} />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Data de Início" htmlFor="debt-start" error={errors.start}>
            <input id="debt-start" type="date" className={inputClass} value={start} onChange={(e) => { setStart(e.target.value); clear("start"); }} />
          </Field>
          <Field label="Dia de Vencimento" htmlFor="debt-due" error={errors.dueDay}>
            <Stepper id="debt-due" label="dia de vencimento" min={1} max={31} value={dueDay} onChange={(v) => { setDueDay(v); clear("dueDay"); }} />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Taxa de Juros Mensal (%)" htmlFor="debt-rate" error={errors.rate}>
            <Input id="debt-rate" inputMode="decimal" className="num" placeholder="0,00" value={rate}
              onChange={(e) => { setRate(e.target.value); clear("rate"); }} aria-invalid={!!errors.rate || undefined} />
          </Field>
          <Field label="Categoria (opcional)" htmlFor="debt-category">
            <select id="debt-category" className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Nenhuma</option>
              {DEBT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              {category && !DEBT_CATEGORIES.includes(category) && <option value={category}>{category}</option>}
            </select>
          </Field>
        </div>
        <Field label="Pessoa Responsável (opcional)" htmlFor="debt-person">
          <select id="debt-person" className={inputClass} value={personId} onChange={(e) => setPersonId(e.target.value)}>
            <option value="">Nenhuma</option>
            <option value={SELF}>{selfName}</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>

        {financing && (
          <fieldset className="flex flex-col gap-4 border-t border-border pt-4">
            <legend className="sr-only">Detalhes do Financiamento</legend>
            <p aria-hidden className="text-sm font-semibold text-text-muted">Detalhes do Financiamento</p>
            <Field label="Descrição do Bem" htmlFor="debt-asset">
              <Input id="debt-asset" maxLength={120} placeholder="Ex: Terreno Lote 5, Carro Civic 2020..." value={asset} onChange={(e) => setAsset(e.target.value)} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Comissão (R$)" htmlFor="debt-commission">
                <MoneyInput id="debt-commission" value={commission} onChange={(v) => {
                  setCommission(v);
                  const c = parseBRL(v), t = parseBRL(total);
                  if (c != null && t) setCommissionPct(pctText((c / t) * 100));
                }} />
              </Field>
              <Field label="Comissão (%)" htmlFor="debt-commission-pct" error={errors.commissionPct}>
                <Input id="debt-commission-pct" inputMode="decimal" className="num" placeholder="0,00" value={commissionPct}
                  onChange={(e) => { setCommissionPct(e.target.value); clear("commissionPct"); syncCommission(e.target.value); }} />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Vendedor" htmlFor="debt-seller">
                <Input id="debt-seller" maxLength={80} placeholder="Nome do vendedor" value={seller} onChange={(e) => setSeller(e.target.value)} />
              </Field>
              <Field label="Valor Final do Bem" htmlFor="debt-final">
                <MoneyInput id="debt-final" value={assetFinal} onChange={setAssetFinal} />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Meses p/ Ficar Pronto" htmlFor="debt-months" error={errors.months}>
                <Input id="debt-months" type="number" inputMode="numeric" min={0} max={600} className="num" value={months}
                  onChange={(e) => { setMonths(e.target.value); clear("months"); }} />
              </Field>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">Custos Extras</span>
                <Button type="button" size="sm" variant="secondary" onClick={() => setExtras((xs) => [...xs, { name: "", amount: "", frequency: "unico" }])}>
                  <Plus aria-hidden className="size-4" />Adicionar Custo
                </Button>
              </div>
              {extras.map((x, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 sm:grid-cols-[1.4fr_1fr_0.9fr_auto]">
                  <Input aria-label={`Custo extra ${i + 1}`} maxLength={60} placeholder="Ex: IPTU, Pintura..." value={x.name} className="col-span-3 sm:col-span-1"
                    onChange={(e) => { setExtra(i, { name: e.target.value }); clear("extras"); }} />
                  <MoneyInput id={`debt-extra-${i}`} value={x.amount} onChange={(v) => { setExtra(i, { amount: v }); clear("extras"); }} />
                  <select aria-label={`Frequência do custo ${i + 1}`} className={inputClass} value={x.frequency}
                    onChange={(e) => setExtra(i, { frequency: e.target.value as ExtraRow["frequency"] })}>
                    {EXTRA_FREQUENCIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  <button type="button" aria-label={`Remover custo ${i + 1}`} onClick={() => setExtras((xs) => xs.filter((_, j) => j !== i))}
                    className="grid size-11 place-items-center rounded-md text-danger hover:bg-surface"><Trash2 aria-hidden className="size-4" /></button>
                </div>
              ))}
              {errors.extras && <p role="alert" className="text-sm text-danger">{errors.extras}</p>}
            </div>
          </fieldset>
        )}

        <Field label="Observações" htmlFor="debt-notes">
          <textarea id="debt-notes" rows={3} maxLength={500} className={textareaClass} placeholder="Anotações sobre a dívida..." value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        {errors.form && <p role="alert" className="text-sm text-danger">{errors.form}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={saving}>{debt ? "Salvar" : "Adicionar Dívida"}</Button>
        </div>
      </form>
    </Dialog>
  );
}
