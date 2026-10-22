"use client";

import { useRef, useState, type FormEvent } from "react";
import { CarFront, Check, GraduationCap, HeartPulse, House, Laptop, Sprout, Target, TreePalm, Upload, User, type LucideIcon } from "lucide-react";
import { repo } from "@/lib/data";
import { today } from "@/lib/dates";
import { GOAL_CATEGORIES, GOAL_COLORS, isPreset, presetImage } from "@/lib/goals";
import { formatBRL, parseBRL } from "@/lib/money";
import type { Goal, GoalCategory, Snapshot } from "@/lib/types";
import { Dialog } from "./Dialog";
import { Button, Field, Input, inputClass } from "./ui";

/* ------------------------------- Imagem da meta ------------------------------- */

// Imagens prontas do Sobra: degradê + ícone, uma por categoria (arte própria, sem ilustrações de terceiros).
const PRESETS: Record<GoalCategory, { icon: LucideIcon; from: string; to: string; ink: string }> = {
  viagem: { icon: TreePalm, from: "#7dd3fc", to: "#fcd34d", ink: "#0f5132" },
  tecnologia: { icon: Laptop, from: "#4f46e5", to: "#a855f7", ink: "#ffffff" },
  educacao: { icon: GraduationCap, from: "#dbeafe", to: "#93c5fd", ink: "#1e3a8a" },
  saude: { icon: HeartPulse, from: "#fee2e2", to: "#fca5a5", ink: "#b91c1c" },
  casa: { icon: House, from: "#fce7f3", to: "#fbcfe8", ink: "#9d174d" },
  veiculo: { icon: CarFront, from: "#1f2937", to: "#111827", ink: "#60a5fa" },
  investimento: { icon: Sprout, from: "#dcfce7", to: "#fde68a", ink: "#166534" },
  outro: { icon: Target, from: "#f472b6", to: "#e11d48", ink: "#ffffff" },
};

const objectPos = { top: "50% 0%", center: "50% 50%", bottom: "50% 100%" } as const;

/** Imagem da meta: pronta, foto enviada ou só a cor. */
export function GoalArt({ image, color, position = "center", className = "", iconClass = "size-12" }: {
  image: string | null; color?: string | null; position?: Goal["imagePosition"]; className?: string; iconClass?: string;
}) {
  if (image && !isPreset(image)) {
    // eslint-disable-next-line @next/next/no-img-element -- foto do usuário em data URL, sem otimização do Next
    return <img src={image} alt="" className={`object-cover ${className}`} style={{ objectPosition: objectPos[position] }} />;
  }
  const p = image ? PRESETS[image.slice(7) as GoalCategory] ?? PRESETS.outro : null;
  if (!p) return <div aria-hidden className={className} style={{ background: color ?? "var(--color-accent)" }} />;
  const Icon = p.icon;
  return (
    <div aria-hidden className={`grid place-items-center ${className}`} style={{ background: `linear-gradient(135deg, ${p.from}, ${p.to})`, color: p.ink }}>
      <Icon className={`${iconClass} drop-shadow`} strokeWidth={1.6} />
    </div>
  );
}

/** Reduz a foto para no máximo 1200 px e WEBP, para caber no banco. */
async function shrink(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, fail) => {
      const i = new Image(); i.onload = () => ok(i); i.onerror = () => fail(new Error("Não foi possível ler a imagem.")); i.src = url;
    });
    const scale = Math.min(1, 1200 / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    for (const q of [0.82, 0.7, 0.55]) {
      const out = c.toDataURL("image/webp", q);
      if (out.length <= 1_400_000) return out;
    }
    throw new Error("A imagem ficou grande demais. Tente outra.");
  } finally { URL.revokeObjectURL(url); }
}

/* ------------------------------- Nova meta / editar ------------------------------- */

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

export function GoalForm({ snap, goal, onClose, onSaved }: { snap: Snapshot; goal?: Goal; onClose: () => void; onSaved: (msg: string) => void }) {
  const people = snap.people.filter((p) => !p.archived);
  const [name, setName] = useState(goal?.name ?? "");
  const [description, setDescription] = useState(goal?.description ?? "");
  const [target, setTarget] = useState(goal ? formatBRL(goal.targetCents).replace(/^R\$\s?/, "") : "");
  const [initial, setInitial] = useState("");
  const [date, setDate] = useState(goal?.targetDate ?? "");
  const [category, setCategory] = useState<GoalCategory>(goal?.category ?? "outro");
  const [personId, setPersonId] = useState(goal?.personId ?? "");
  const [color, setColor] = useState(goal?.color ?? GOAL_COLORS[0]);
  const [tab, setTab] = useState<"prontas" | "upload">(goal?.image && !isPreset(goal.image) ? "upload" : "prontas");
  const [image, setImage] = useState<string | null>(goal ? goal.image : presetImage("outro"));
  const [upload, setUpload] = useState<{ name: string; data: string } | null>(goal?.image && !isPreset(goal.image) ? { name: "Imagem atual", data: goal.image } : null);
  const [position, setPosition] = useState<Goal["imagePosition"]>(goal?.imagePosition ?? "center");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [reading, setReading] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const clear = (k: string) => setErrors((x) => ({ ...x, [k]: "" }));

  function pickCategory(c: GoalCategory) {
    setCategory(c);
    // Quem ainda está na imagem pronta acompanha a categoria.
    if (tab === "prontas" && (image === null || isPreset(image))) setImage(presetImage(c));
  }

  async function onFile(f: File | undefined) {
    if (!f) return;
    if (!TYPES.includes(f.type)) { setErrors((x) => ({ ...x, image: "Use JPG, PNG ou WEBP." })); return; }
    if (f.size > MAX_BYTES) { setErrors((x) => ({ ...x, image: "A imagem passa de 5MB." })); return; }
    setReading(true); clear("image");
    try {
      const data = await shrink(f);
      setUpload({ name: f.name, data }); setImage(data);
    } catch (e) { setErrors((x) => ({ ...x, image: e instanceof Error ? e.message : "Não foi possível ler a imagem." })); }
    finally { setReading(false); }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    const cents = parseBRL(target);
    const start = initial.trim() ? parseBRL(initial) : 0;
    if (!name.trim()) errs.name = "Informe o nome da meta.";
    if (!cents) errs.target = "Informe o valor, por exemplo 5.000,00.";
    if (initial.trim() && !start) errs.initial = "Valor inválido.";
    if (date && date < today() && !goal) errs.date = "A data precisa ser hoje ou depois.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      const saved = await repo.upsertGoal({
        id: goal?.id, name: name.trim(), description: description.trim(), targetCents: cents!, targetDate: date || null,
        status: goal?.status ?? "active", category, personId: personId || null, color, image, imagePosition: position,
        completedAt: goal?.completedAt ?? null,
      });
      if (start) await repo.addContribution({ goalId: saved.id, amountCents: start, contributedOn: today(), personId: personId || null });
      onSaved(goal ? "Meta atualizada" : "Meta criada");
      onClose();
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : "Não foi possível salvar." });
    } finally { setSaving(false); }
  }

  const segBtn = "h-10 rounded-md border border-border text-sm font-semibold aria-checked:border-accent aria-checked:bg-accent aria-checked:text-on-accent";
  return (
    <Dialog onClose={onClose} title={<h2 className="text-lg font-semibold">{goal ? "Editar Meta" : "Nova Meta"}</h2>}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Field label="Nome da Meta" htmlFor="goal-name" error={errors.name}>
          <Input id="goal-name" autoFocus maxLength={60} value={name} placeholder="Ex.: Viagem para a praia"
            onChange={(e) => { setName(e.target.value); clear("name"); }} aria-invalid={!!errors.name || undefined} />
        </Field>
        <Field label="Descrição (opcional)" htmlFor="goal-desc">
          <textarea id="goal-desc" rows={2} maxLength={500} className={`${inputClass} h-auto py-2`} value={description}
            onChange={(e) => setDescription(e.target.value)} placeholder="Para que é esse dinheiro?" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Valor Meta" htmlFor="goal-target" error={errors.target}>
            <MoneyInput id="goal-target" value={target} onChange={(v) => { setTarget(v); clear("target"); }} invalid={!!errors.target} />
          </Field>
          {!goal && (
            <Field label="Já guardado (opcional)" htmlFor="goal-initial" error={errors.initial}>
              <MoneyInput id="goal-initial" value={initial} onChange={(v) => { setInitial(v); clear("initial"); }} invalid={!!errors.initial} />
            </Field>
          )}
        </div>
        <Field label="Data Limite (opcional)" htmlFor="goal-date" error={errors.date}>
          <input id="goal-date" type="date" className={inputClass} value={date} onChange={(e) => { setDate(e.target.value); clear("date"); }} />
        </Field>
        <Field label="Categoria" htmlFor="goal-cat">
          <select id="goal-cat" className={inputClass} value={category} onChange={(e) => pickCategory(e.target.value as GoalCategory)}>
            {GOAL_CATEGORIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </Field>
        <Field label="Pessoa (Opcional)" htmlFor="goal-person">
          <div className="relative">
            <User aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
            <select id="goal-person" className={`${inputClass} pl-9`} value={personId} onChange={(e) => setPersonId(e.target.value)}>
              <option value="">Sem pessoa</option>
              {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </Field>

        <fieldset>
          <legend className="mb-2 text-xs font-semibold text-text-muted">Cor</legend>
          <div role="radiogroup" aria-label="Cor" className="grid grid-cols-3 gap-2">
            {GOAL_COLORS.map((c, i) => (
              <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={`Cor ${i + 1}`} onClick={() => setColor(c)}
                className="grid h-10 place-items-center rounded-md ring-offset-2 ring-offset-bg aria-checked:ring-2 aria-checked:ring-accent" style={{ background: c }}>
                {color === c && <Check aria-hidden className="size-4 text-white" />}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 text-xs font-semibold text-text-muted">Imagem</legend>
          <div role="tablist" aria-label="Imagem" className="grid grid-cols-2 gap-1 rounded-md bg-surface p-1">
            {([["prontas", "Imagens Prontas"], ["upload", "Upload"]] as const).map(([v, l]) => (
              <button key={v} type="button" role="tab" aria-selected={tab === v}
                onClick={() => { setTab(v); setImage(v === "upload" ? upload?.data ?? null : presetImage(category)); }}
                className="h-9 rounded-md text-sm font-semibold text-text-muted aria-selected:bg-surface-raised aria-selected:text-text aria-selected:shadow-card">{l}</button>
            ))}
          </div>
          {tab === "prontas" ? (
            <div role="radiogroup" aria-label="Imagens prontas" className="grid grid-cols-4 gap-2">
              {GOAL_CATEGORIES.map(([k, l]) => (
                <button key={k} type="button" role="radio" aria-checked={image === presetImage(k)} aria-label={l} title={l} onClick={() => setImage(presetImage(k))}
                  className="overflow-hidden rounded-md border-2 border-transparent aria-checked:border-accent">
                  <GoalArt image={presetImage(k)} className="aspect-square w-full" iconClass="size-9" />
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <div className="flex gap-2">
                <span className="flex h-10 min-w-0 flex-1 items-center truncate rounded-md border border-border px-3 text-sm text-text-muted">
                  {upload?.name ?? "Nenhum arquivo selecionado"}
                </span>
                <Button type="button" loading={reading} onClick={() => file.current?.click()}><Upload aria-hidden className="size-4" />Escolher</Button>
                <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Escolher imagem"
                  onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ""; }} />
              </div>
              <p className="text-xs text-text-muted">Máximo 5MB. Formatos: JPG, PNG, WEBP.</p>
            </div>
          )}
          {errors.image && <p role="alert" className="text-sm text-danger">{errors.image}</p>}
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-xs font-semibold text-text-muted">Posição da Imagem</legend>
          <div role="radiogroup" aria-label="Posição da Imagem" className="grid grid-cols-3 gap-2">
            {([["top", "Topo"], ["center", "Centro"], ["bottom", "Embaixo"]] as const).map(([v, l]) => (
              <button key={v} type="button" role="radio" aria-checked={position === v} onClick={() => setPosition(v)} className={segBtn}>{l}</button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-text-muted">Escolha qual parte da imagem ficará visível no card</p>
        </fieldset>

        <div>
          <p className="mb-2 text-xs font-semibold text-text-muted">Pré-visualização</p>
          <div className="overflow-hidden rounded-lg border border-border">
            <div className="relative h-32" style={{ background: color }}>
              <GoalArt image={image} color={color} position={position} className="absolute inset-0 size-full" />
            </div>
            <div className="flex flex-col gap-1.5 p-3">
              <p className="truncate font-semibold">{name.trim() || "Nome da meta"}</p>
              <div className="h-2 overflow-hidden rounded-pill bg-surface"><span className="block h-full rounded-pill" style={{ background: color, width: `${Math.min(100, ((parseBRL(initial) ?? 0) / (parseBRL(target) || 1)) * 100)}%` }} /></div>
              <p className="num text-xs text-text-muted">{formatBRL(parseBRL(initial) ?? 0)} de {formatBRL(parseBRL(target) ?? 0)}</p>
            </div>
          </div>
        </div>

        {errors.form && <p role="alert" className="text-sm text-danger">{errors.form}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={saving}>{goal ? "Salvar" : "Criar Meta"}</Button>
        </div>
      </form>
    </Dialog>
  );
}

function MoneyInput({ id, value, onChange, invalid }: { id: string; value: string; onChange: (v: string) => void; invalid?: boolean }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">R$</span>
      <Input id={id} inputMode="decimal" className="num pl-10" placeholder="0,00" value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={invalid || undefined} />
    </div>
  );
}

/* ------------------------------- Guardar / retirar ------------------------------- */

export function ContributionModal({ goal, savedCents, mode, onClose, onSaved }: {
  goal: Goal; savedCents: number; mode: "add" | "withdraw"; onClose: () => void; onSaved: (msg: string, reached: boolean) => void;
}) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const add = mode === "add";

  async function submit(e: FormEvent) {
    e.preventDefault();
    const cents = parseBRL(amount);
    if (!cents) { setError("Informe o valor."); return; }
    if (!add && cents > savedCents) { setError(`Só há ${formatBRL(savedCents)} guardados nesta meta.`); return; }
    setSaving(true);
    try {
      await repo.addContribution({ goalId: goal.id, amountCents: add ? cents : -cents, contributedOn: date, personId: goal.personId });
      onSaved(add ? `${formatBRL(cents)} guardados` : `${formatBRL(cents)} retirados`, add && savedCents + cents >= goal.targetCents);
      onClose();
    } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível salvar."); }
    finally { setSaving(false); }
  }

  return (
    <Dialog onClose={onClose} title={<h2 className="text-lg font-semibold">{add ? "Guardar dinheiro" : "Retirar dinheiro"} · {goal.name}</h2>}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <p className="text-sm text-text-muted">Guardado até agora: <b className="num text-text">{formatBRL(savedCents)}</b> de {formatBRL(goal.targetCents)}</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Valor" htmlFor="contrib-amount" error={error}>
            <MoneyInput id="contrib-amount" value={amount} onChange={(v) => { setAmount(v); setError(""); }} invalid={!!error} />
          </Field>
          <Field label="Data" htmlFor="contrib-date">
            <input id="contrib-date" type="date" className={inputClass} value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant={add ? "primary" : "danger"} loading={saving}>{add ? "Guardar" : "Retirar"}</Button>
        </div>
      </form>
    </Dialog>
  );
}
