"use client";

import { useState, type FormEvent } from "react";
import { ArrowDownCircle, ArrowUpCircle, Check, Repeat } from "lucide-react";
import { repo } from "@/lib/data";
import { CATEGORY_COLORS, CATEGORY_ICONS, inkOn, normName } from "@/lib/categories";
import { formatBRL, parseBRL } from "@/lib/money";
import type { Category, CategoryKind } from "@/lib/types";
import { categoryIcons } from "./CategoryIcon";
import { Dialog } from "./Dialog";
import { Button, Field, Input } from "./ui";

const kindHint: Record<CategoryKind, string> = {
  expense: "Aparecerá apenas em despesas",
  income: "Aparecerá apenas em receitas",
  both: "Aparecerá em despesas e em receitas",
};

/** Primeiro passo de "Adicionar categoria": para que ela será usada. */
export function CategoryKindPicker({ onPick, onClose }: { onPick: (k: CategoryKind) => void; onClose: () => void }) {
  const options: [CategoryKind, string, typeof Repeat, string][] = [
    ["expense", "Despesas", ArrowDownCircle, "text-expense"],
    ["income", "Receitas", ArrowUpCircle, "text-income"],
    ["both", "Ambos (Despesas e Receitas)", Repeat, "text-accent"],
  ];
  return (
    <Dialog onClose={onClose} title={<div><h2 className="text-lg font-semibold">Tipo de Categoria</h2><p className="mt-1 text-sm text-text-muted">Para que esta categoria será usada?</p></div>}>
      <div className="flex flex-col gap-2">
        {options.map(([k, label, Icon, tone]) => (
          <button key={k} type="button" onClick={() => onPick(k)}
            className="flex h-14 items-center gap-3 rounded-md border border-border px-4 text-left font-medium hover:border-accent hover:bg-accent-soft">
            <Icon aria-hidden className={`size-5 ${tone}`} />{label}
          </button>
        ))}
      </div>
    </Dialog>
  );
}

/** Nova categoria ou edição: nome, ícone, cor, limite (despesa) ou meta (receita) e tipo. */
export function CategoryForm({ category, initialKind, existing, onClose, onSaved }: {
  category?: Category; initialKind: CategoryKind; existing: Category[];
  onClose: () => void; onSaved: (msg: string) => void;
}) {
  const [name, setName] = useState(category?.name ?? "");
  const [icon, setIcon] = useState(category?.icon || CATEGORY_ICONS[0][0]);
  const [color, setColor] = useState(category?.color ?? CATEGORY_COLORS[0]);
  const [kind, setKind] = useState<CategoryKind>(category?.kind ?? initialKind);
  const [hasLimit, setHasLimit] = useState(!!category?.monthlyLimitCents);
  const [limit, setLimit] = useState(category?.monthlyLimitCents ? formatBRL(category.monthlyLimitCents).replace(/^R\$\s?/, "") : "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const income = kind === "income";
  const limitLabel = income ? "Definir meta de receita" : "Definir limite de gastos";

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    const cents = hasLimit ? parseBRL(limit) : null;
    if (!name.trim()) errs.name = "Informe o nome.";
    else if (existing.some((c) => c.id !== category?.id && c.kind === kind && normName(c.name) === normName(name))) errs.name = "Já existe uma categoria com esse nome.";
    if (hasLimit && !cents) errs.limit = income ? "Informe a meta, por exemplo 3.000,00." : "Informe o limite, por exemplo 800,00.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      await repo.upsertCategory({
        id: category?.id, name: name.trim(), icon, color, kind,
        monthlyLimitCents: hasLimit ? cents : null, archived: category?.archived ?? false,
      });
      onSaved(category ? "Categoria atualizada" : "Categoria criada");
      onClose();
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : "Não foi possível salvar." });
    } finally { setSaving(false); }
  }

  return (
    <Dialog wide onClose={onClose} title={<h2 className="text-lg font-semibold">{category ? "Editar Categoria" : "Nova Categoria"}</h2>}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-5">
        <Field label="Nome da Categoria" htmlFor="cat-name" error={errors.name}>
          <Input id="cat-name" autoFocus value={name} onChange={(e) => { setName(e.target.value); setErrors((x) => ({ ...x, name: "" })); }} placeholder="Ex.: Pets" maxLength={40} aria-invalid={!!errors.name || undefined} />
        </Field>

        <fieldset>
          <legend className="mb-2 text-xs font-semibold text-text-muted">Ícone</legend>
          <div role="radiogroup" aria-label="Ícone" className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto p-0.5 sm:grid-cols-4">
            {CATEGORY_ICONS.map(([key, label]) => {
              const Icon = categoryIcons[key];
              const on = icon === key;
              return (
                <button key={key} type="button" role="radio" aria-checked={on} onClick={() => setIcon(key)}
                  className="flex flex-col items-center gap-1.5 rounded-md border-2 border-transparent bg-surface px-2 py-3 text-xs aria-checked:border-accent aria-checked:bg-accent-soft">
                  <span className="grid size-10 place-items-center rounded-pill" style={{ background: color, color: inkOn(color) }}>
                    <Icon aria-hidden className="size-5" />
                  </span>
                  {label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-xs font-semibold text-text-muted">Cor</legend>
          <div role="radiogroup" aria-label="Cor" className="grid grid-cols-6 gap-2">
            {CATEGORY_COLORS.map((c, i) => (
              <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={`Cor ${i + 1}`} onClick={() => setColor(c)}
                className="grid h-9 place-items-center rounded-md ring-offset-2 ring-offset-bg aria-checked:ring-2 aria-checked:ring-accent" style={{ background: c }}>
                {color === c && <Check aria-hidden className="size-4" style={{ color: inkOn(c) }} />}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-col gap-3">
          <label className="flex items-center justify-between gap-3 text-sm font-semibold">
            {limitLabel}
            <input type="checkbox" role="switch" checked={hasLimit} onChange={(e) => setHasLimit(e.target.checked)}
              className="relative h-6 w-11 cursor-pointer appearance-none rounded-pill bg-border transition-colors before:absolute before:left-0.5 before:top-0.5 before:size-5 before:rounded-pill before:bg-bg before:shadow-card before:transition-transform checked:bg-accent checked:before:translate-x-5" />
          </label>
          {hasLimit && (
            <Field label={income ? "Meta Mensal" : "Limite Mensal"} htmlFor="cat-limit" error={errors.limit}>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">R$</span>
                <Input id="cat-limit" inputMode="decimal" value={limit} onChange={(e) => { setLimit(e.target.value); setErrors((x) => ({ ...x, limit: "" })); }} placeholder="0,00" className="num pl-10" aria-invalid={!!errors.limit || undefined} />
              </div>
            </Field>
          )}
        </div>

        <fieldset>
          <legend className="mb-2 text-xs font-semibold text-text-muted">Tipo de Categoria</legend>
          <div role="radiogroup" aria-label="Tipo de Categoria" className="grid grid-cols-3 gap-2">
            {([["expense", "Despesa", "aria-checked:bg-expense"], ["income", "Receita", "aria-checked:bg-income"], ["both", "Ambos", "aria-checked:bg-accent"]] as const).map(([k, label, on]) => (
              <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)}
                className={`h-10 rounded-md bg-surface text-sm font-semibold aria-checked:text-on-accent ${on}`}>{label}</button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-text-muted">{kindHint[kind]}</p>
        </fieldset>

        {errors.form && <p role="alert" className="text-sm text-danger">{errors.form}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={saving}>Salvar</Button>
        </div>
      </form>
    </Dialog>
  );
}
