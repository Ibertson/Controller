"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Check, ChevronDown, Landmark, PieChart, Building2, Target, TrendingUp, Wallet, type LucideIcon } from "lucide-react";
import { repo } from "@/lib/data";
import { today } from "@/lib/dates";
import { INVESTMENT_TYPES } from "@/lib/investments";
import { formatBRL, parseBRL } from "@/lib/money";
import type { Investment, InvestmentGoal, InvestmentType } from "@/lib/types";
import { Dialog } from "./Dialog";
import { Button, Field, Input, inputClass } from "./ui";

export const TYPE_ICON: Record<InvestmentType, LucideIcon> = { tesouro: Landmark, cdb: Building2, acoes: TrendingUp, fundos: PieChart, outros: Wallet };
export const TYPE_COLOR: Record<InvestmentType, string> = {
  tesouro: "var(--color-chart-1)", cdb: "var(--color-chart-3)", acoes: "var(--color-chart-4)", fundos: "var(--color-chart-5)", outros: "var(--color-chart-6)",
};
const ALL = "todos";

const centsText = (c: number | null | undefined) => (c == null ? "" : formatBRL(c).replace(/^R\$\s?/, ""));
const textareaClass = `${inputClass} h-auto min-h-24 py-2.5`;

/** Lista com ícones (no lugar do select comum), como na tela original. */
function TypeSelect<T extends string>({ id, value, options, onChange, colored }: {
  id: string; value: T; options: { value: T; label: string; icon: LucideIcon; color: string }[]; onChange: (v: T) => void; colored?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value) ?? options[0];
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  function pick(v: T) { onChange(v); setOpen(false); }
  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Escape" && open) { e.stopPropagation(); setOpen(false); return; }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) { setOpen(true); setActive(options.indexOf(current)); return; }
      setActive((i) => (i + (e.key === "ArrowDown" ? 1 : options.length - 1)) % options.length);
    }
    if ((e.key === "Enter" || e.key === " ") && open) { e.preventDefault(); pick(options[active].value); }
  }
  const Icon = current.icon;
  return (
    <div ref={wrap} className="relative" onKeyDown={onKey}>
      <button id={id} type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => { setOpen((o) => !o); setActive(options.indexOf(current)); }}
        className={`${inputClass} flex items-center gap-2.5 text-left`}>
        <Icon aria-hidden className="size-5 shrink-0" style={colored ? { color: current.color } : undefined} />
        <span className="flex-1 truncate">{current.label}</span>
        <ChevronDown aria-hidden className="size-4 text-text-muted" />
      </button>
      {open && (
        <ul role="listbox" aria-labelledby={id} aria-activedescendant={`${id}-${options[active].value}`}
          className="absolute inset-x-0 top-full z-10 mt-1 rounded-md border border-border bg-bg p-1 shadow-pop">
          {options.map((o, i) => {
            const I = o.icon;
            return (
              <li key={o.value} id={`${id}-${o.value}`} role="option" aria-selected={o.value === value} onMouseEnter={() => setActive(i)}
                onClick={() => pick(o.value)}
                className={`flex cursor-pointer items-center gap-2.5 rounded-sm px-2 py-2 ${i === active ? "bg-surface" : ""}`}>
                <Check aria-hidden className={`size-4 shrink-0 ${o.value === value ? "" : "invisible"}`} />
                <I aria-hidden className="size-5 shrink-0" style={colored ? { color: o.color } : undefined} />
                {o.label}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

const typeOptions = INVESTMENT_TYPES.map(([value, label]) => ({ value, label, icon: TYPE_ICON[value], color: TYPE_COLOR[value] }));

function MoneyInput({ id, value, onChange, invalid }: { id: string; value: string; onChange: (v: string) => void; invalid?: boolean }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">R$</span>
      <Input id={id} inputMode="decimal" className="num pl-10" placeholder="0,00" value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={invalid || undefined} />
    </div>
  );
}

/** Novo investimento ou editar um existente. */
export function InvestmentModal({ item, onClose, onSaved }: { item?: Investment; onClose: () => void; onSaved: (msg: string) => void }) {
  const [name, setName] = useState(item?.name ?? "");
  const [type, setType] = useState<InvestmentType>(item?.type ?? "tesouro");
  const [institution, setInstitution] = useState(item?.institution ?? "");
  const [invested, setInvested] = useState(centsText(item?.investedCents));
  const [current, setCurrent] = useState(centsText(item?.currentCents));
  const [income, setIncome] = useState(item?.incomeCents ? centsText(item.incomeCents) : "");
  const [rate, setRate] = useState(item?.rate == null ? "" : String(item.rate).replace(".", ","));
  const [bought, setBought] = useState(item?.boughtOn ?? today());
  const [maturity, setMaturity] = useState(item?.maturityOn ?? "");
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const clear = (k: string) => setErrors((x) => ({ ...x, [k]: "" }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    const investedCents = parseBRL(invested);
    const currentCents = current.trim() ? parseBRL(current) : null;
    const incomeCents = income.trim() ? parseBRL(income) : 0;
    const rateNum = rate.trim() ? Number(rate.replace(/\./g, "").replace(",", ".")) : null;
    if (!name.trim()) errs.name = "Informe o nome do investimento.";
    if (!investedCents) errs.invested = "Informe o valor aplicado, por exemplo 1.000,00.";
    if (current.trim() && currentCents == null) errs.current = "Valor inválido.";
    if (income.trim() && incomeCents == null) errs.income = "Valor inválido.";
    if (rateNum != null && (!Number.isFinite(rateNum) || Math.abs(rateNum) >= 100000)) errs.rate = "Use um número, por exemplo 10,50.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(bought)) errs.bought = "Escolha a data da compra.";
    if (maturity && maturity < bought) errs.maturity = "O vencimento vem depois da compra.";
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) return;
    setSaving(true);
    try {
      await repo.upsertInvestment({
        id: item?.id, name: name.trim(), type, institution: institution.trim(), investedCents: investedCents!,
        currentCents, incomeCents: incomeCents ?? 0, rate: rateNum == null ? null : Math.round(rateNum * 100) / 100,
        boughtOn: bought, maturityOn: maturity || null, notes: notes.trim(),
      });
      onSaved(item ? "Investimento atualizado" : "Investimento adicionado");
      onClose();
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : "Não foi possível salvar." });
    } finally { setSaving(false); }
  }

  return (
    <Dialog onClose={onClose} title={<h2 className="text-lg font-semibold">{item ? "Editar Investimento" : "Novo Investimento"}</h2>}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Field label="Nome do Investimento *" htmlFor="inv-name" error={errors.name}>
          <Input id="inv-name" autoFocus maxLength={80} placeholder="Ex: Tesouro Selic 2029" value={name}
            onChange={(e) => { setName(e.target.value); clear("name"); }} aria-invalid={!!errors.name || undefined} />
        </Field>
        <Field label="Tipo *" htmlFor="inv-type">
          <TypeSelect id="inv-type" value={type} options={typeOptions} onChange={setType} />
        </Field>
        <Field label="Instituição / Corretora" htmlFor="inv-inst">
          <Input id="inv-inst" maxLength={80} placeholder="Ex: Nubank, XP, Rico" value={institution} onChange={(e) => setInstitution(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Valor Aplicado *" htmlFor="inv-invested" error={errors.invested}>
            <MoneyInput id="inv-invested" value={invested} invalid={!!errors.invested} onChange={(v) => { setInvested(v); clear("invested"); }} />
          </Field>
          <Field label="Valor Atual" htmlFor="inv-current" error={errors.current} hint="Vazio = igual ao aplicado">
            <MoneyInput id="inv-current" value={current} invalid={!!errors.current} onChange={(v) => { setCurrent(v); clear("current"); }} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Proventos Recebidos" htmlFor="inv-income" error={errors.income}>
            <MoneyInput id="inv-income" value={income} invalid={!!errors.income} onChange={(v) => { setIncome(v); clear("income"); }} />
          </Field>
          <Field label="Taxa de Rendimento (%)" htmlFor="inv-rate" error={errors.rate}>
            <Input id="inv-rate" inputMode="decimal" className="num" placeholder="0,00" value={rate}
              onChange={(e) => { setRate(e.target.value); clear("rate"); }} aria-invalid={!!errors.rate || undefined} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Data da Compra *" htmlFor="inv-bought" error={errors.bought}>
            <input id="inv-bought" type="date" className={inputClass} value={bought} onChange={(e) => { setBought(e.target.value); clear("bought"); }} />
          </Field>
          <Field label="Data de Vencimento" htmlFor="inv-maturity" error={errors.maturity}>
            <input id="inv-maturity" type="date" className={inputClass} value={maturity} onChange={(e) => { setMaturity(e.target.value); clear("maturity"); }} />
          </Field>
        </div>
        <Field label="Observações" htmlFor="inv-notes">
          <textarea id="inv-notes" rows={3} maxLength={500} className={textareaClass} placeholder="Anotações sobre o investimento..." value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        {errors.form && <p role="alert" className="text-sm text-danger">{errors.form}</p>}
        <div className="grid grid-cols-2 gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={saving}>{item ? "Salvar" : "Adicionar"}</Button>
        </div>
      </form>
    </Dialog>
  );
}

const goalTypeOptions: { value: InvestmentType | typeof ALL; label: string; icon: LucideIcon; color: string }[] = [
  { value: ALL, label: "Todos os Tipos", icon: Target, color: "var(--color-chart-2)" }, ...typeOptions,
];

/** Nova meta de investimento ou editar uma existente. */
export function InvestmentGoalModal({ goal, onClose, onSaved }: { goal?: InvestmentGoal; onClose: () => void; onSaved: (msg: string) => void }) {
  const [name, setName] = useState(goal?.name ?? "");
  const [target, setTarget] = useState(centsText(goal?.targetCents));
  const [assetType, setAssetType] = useState<InvestmentType | typeof ALL>(goal?.assetType ?? ALL);
  const [deadline, setDeadline] = useState(goal?.deadline ?? "");
  const [description, setDescription] = useState(goal?.description ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const clear = (k: string) => setErrors((x) => ({ ...x, [k]: "" }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    const cents = parseBRL(target);
    if (!name.trim()) errs.name = "Informe o nome da meta.";
    if (!cents) errs.target = "Informe o valor da meta, por exemplo 10.000,00.";
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) return;
    setSaving(true);
    try {
      await repo.upsertInvestmentGoal({
        id: goal?.id, name: name.trim(), targetCents: cents!, assetType: assetType === ALL ? null : assetType,
        deadline: deadline || null, description: description.trim(),
      });
      onSaved(goal ? "Meta atualizada" : "Meta criada");
      onClose();
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : "Não foi possível salvar." });
    } finally { setSaving(false); }
  }

  return (
    <Dialog onClose={onClose} title={
      <h2 className="flex items-center gap-2 text-lg font-semibold"><Target aria-hidden className="size-6 text-accent" />{goal ? "Editar Meta de Investimento" : "Nova Meta de Investimento"}</h2>
    }>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Field label="Nome da Meta *" htmlFor="ig-name" error={errors.name}>
          <Input id="ig-name" autoFocus maxLength={80} placeholder="Ex: Reserva de Emergência" value={name}
            onChange={(e) => { setName(e.target.value); clear("name"); }} aria-invalid={!!errors.name || undefined} />
        </Field>
        <Field label="Valor da Meta *" htmlFor="ig-target" error={errors.target}>
          <MoneyInput id="ig-target" value={target} invalid={!!errors.target} onChange={(v) => { setTarget(v); clear("target"); }} />
        </Field>
        <Field label="Tipo de Ativo" htmlFor="ig-type" hint="O progresso soma o que você tem nesse tipo de investimento">
          <TypeSelect id="ig-type" value={assetType} options={goalTypeOptions} onChange={setAssetType} colored />
        </Field>
        <Field label="Prazo (opcional)" htmlFor="ig-deadline">
          <input id="ig-deadline" type="date" className={inputClass} value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </Field>
        <Field label="Descrição (opcional)" htmlFor="ig-desc">
          <textarea id="ig-desc" rows={3} maxLength={500} className={textareaClass} placeholder="Descreva sua meta..." value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        {errors.form && <p role="alert" className="text-sm text-danger">{errors.form}</p>}
        <div className="grid grid-cols-2 gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={saving}>{goal ? "Salvar" : "Criar Meta"}</Button>
        </div>
      </form>
    </Dialog>
  );
}
