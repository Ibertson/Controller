"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Check, ChevronDown, CreditCard, Search } from "lucide-react";
import { ACCOUNT_KINDS, BANKS, DEBIT_BRANDS, avatarColor, searchBanks, SUB_COLORS, accountName, accountTitle, balanceBreakdown, bankInitials, initialForCurrent, subaccounts } from "@/lib/accounts";
import { repo, useSnapshot } from "@/lib/data";
import { formatBRL, parseBRL } from "@/lib/money";
import { accountBalances } from "@/lib/summary";
import type { Account, AccountKind } from "@/lib/types";
import { CARD_BRANDS, CARD_COLORS, COLOR_NAMES, cardBackground } from "./CardModal";
import { Dialog } from "./Dialog";
import { Button, Field, Input, Segmented, Switch, inputClass } from "./ui";
import { PersonOptions } from "./people";

/** Valor em reais digitado; aceita "-" na frente. null = inválido. */
function money(v: string, allowNegative = false): number | null {
  const t = v.trim();
  if (!t) return 0;
  const neg = allowNegative && t.startsWith("-");
  const c = parseBRL(t.replace(/^-/, ""));
  return c == null ? null : neg ? -c : c;
}
const plain = (cents: number) => formatBRL(Math.abs(cents)).replace(/^R\$\s?/, "").replace(/^/, cents < 0 ? "-" : "");

function MoneyInput({ id, value, onChange, invalid }: { id: string; value: string; onChange: (v: string) => void; invalid?: boolean }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">R$</span>
      <Input id={id} inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} placeholder="0,00"
        className="num pl-10" aria-invalid={invalid || undefined} aria-describedby={invalid ? `${id}-error` : undefined} />
    </div>
  );
}

/** Círculo com as iniciais do banco (sem logos). */
export function BankAvatar({ name, className = "size-10 text-sm" }: { name: string; className?: string }) {
  return <span aria-hidden className={`grid shrink-0 place-items-center rounded-pill bg-white/20 font-bold ${className}`}>{bankInitials(name)}</span>;
}

/** Círculo pequeno com as iniciais do banco, cor fixa por nome. */
export function BankDot({ name }: { name: string }) {
  return <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-pill text-[11px] font-bold text-white" style={{ background: avatarColor(name) }}>{bankInitials(name)}</span>;
}

/** "Selecionar Banco": lista com busca; sem resultado, usa o nome digitado. */
export function BankPicker({ onClose, onPick }: { onClose: () => void; onPick: (bank: string) => void }) {
  const [q, setQ] = useState("");
  const list = searchBanks(q, BANKS);
  const typed = q.trim();
  return (
    <Dialog onClose={onClose} title={<h2 className="text-lg font-semibold">Selecionar Banco</h2>}>
      <div className="relative mb-2">
        <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
        <Input autoFocus aria-label="Buscar banco" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar banco..." className="pl-9"
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const pick = list[0] ?? typed; if (pick) onPick(pick); } }} />
      </div>
      <ul className="-mx-2 max-h-[60dvh] overflow-y-auto" aria-label="Bancos">
        {list.map((b) => (
          <li key={b}>
            <button type="button" onClick={() => onPick(b)} className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm hover:bg-surface">
              <BankDot name={b} />{b}
            </button>
          </li>
        ))}
        {list.length === 0 && typed && (
          <li>
            <button type="button" onClick={() => onPick(typed)} className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm hover:bg-surface">
              <BankDot name={typed} />Usar &quot;{typed}&quot;
            </button>
          </li>
        )}
      </ul>
    </Dialog>
  );
}

/** Faixa colorida da conta (prévia e topo da página da conta). */
export function AccountBanner({ bank, kind, color, children }: { bank: string; kind: string; color: string | null | undefined; children?: ReactNode }) {
  return (
    <div className="rounded-lg p-4 text-white" style={{ background: cardBackground({ color: color ?? "verde" }) }}>
      <div className="flex items-center gap-3">
        <BankAvatar name={bank || "?"} />
        <div className="min-w-0">
          <div className="text-xs opacity-80">{kind}</div>
          <div className="truncate text-lg font-semibold">{bank || "Banco"}</div>
        </div>
      </div>
      {children}
    </div>
  );
}

/** Lista de cores com amostra, como um select. */
function ColorSelect({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const off = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", off);
    return () => document.removeEventListener("mousedown", off);
  }, [open]);
  const swatch = (k: string) => <span aria-hidden className="size-5 rounded-sm" style={{ background: CARD_COLORS[k] }} />;
  return (
    <div ref={ref} className="relative">
      <button id={id} type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)}
        className={`${inputClass} flex items-center gap-2 text-left`}>
        {swatch(value)}<span className="flex-1">{COLOR_NAMES[value]}</span><ChevronDown aria-hidden className="size-4 text-text-muted" />
      </button>
      {open && (
        <ul role="listbox" aria-labelledby={id} className="absolute inset-x-0 bottom-full z-10 mb-1 max-h-72 overflow-y-auto rounded-md border border-border bg-bg p-1 shadow-pop">
          {Object.keys(CARD_COLORS).map((k) => (
            <li key={k} role="option" aria-selected={k === value}>
              <button type="button" onClick={() => { onChange(k); setOpen(false); }}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm hover:bg-surface">
                <Check aria-hidden className={`size-4 ${k === value ? "" : "invisible"}`} />{swatch(k)}{COLOR_NAMES[k]}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const dayOk = (v: string) => { const n = Number(v); return Number.isInteger(n) && n >= 1 && n <= 31 ? n : null; };

/** Nova conta ou "Editar Conta Bancária". */
export function AccountModal({ account, onClose, onSaved }: { account?: Account; onClose: () => void; onSaved: (msg: string, id: string) => void }) {
  const snap = useSnapshot();
  const current = account && snap ? accountBalances(snap).get(account.id) ?? account.initialBalanceCents : 0;
  const [f, setF] = useState({
    personId: account?.personId ?? "", bank: account ? accountTitle(account) : "", kind: (account?.kind ?? "checking") as AccountKind,
    label: account?.label ?? "", balance: account ? plain(current) : "", color: account?.color ?? "verde",
    hasOverdraft: account?.overdraftCents != null, overdraft: account?.overdraftCents ? plain(account.overdraftCents) : "",
    hasDebit: account?.hasDebit ?? false, debitLast4: account?.debitLast4 ?? "", debitBrand: account?.debitBrand ?? "",
    credit: false, cardName: "", cardLast4: "", cardBrand: "", cardLimit: "", cardClosing: "", cardDue: "", cardColor: "grafite",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState(false);
  const set = <K extends keyof typeof f>(k: K) => (v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  if (!snap) return null;
  const linkedCards = account ? snap.cards.filter((c) => c.paymentAccountId === account.id && !c.archived) : [];

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    const balance = money(f.balance, true);
    const overdraft = f.hasOverdraft ? money(f.overdraft) : null;
    const limit = f.credit ? money(f.cardLimit) : 0;
    if (!f.bank.trim()) errs.bank = "Informe o banco.";
    if (balance == null) errs.balance = "Valor inválido. Use algo como 1.250,00.";
    if (f.hasOverdraft && overdraft == null) errs.overdraft = "Valor inválido.";
    if (f.hasDebit && f.debitLast4 && !/^\d{4}$/.test(f.debitLast4)) errs.debitLast4 = "Use os 4 últimos números.";
    if (f.credit) {
      if (f.cardLast4 && !/^\d{4}$/.test(f.cardLast4)) errs.cardLast4 = "Use os 4 últimos números.";
      if (!f.cardBrand) errs.cardBrand = "Escolha a bandeira.";
      if (limit == null) errs.cardLimit = "Valor inválido.";
      if (!dayOk(f.cardClosing)) errs.cardClosing = "Dia de 1 a 31.";
      if (!dayOk(f.cardDue)) errs.cardDue = "Dia de 1 a 31.";
    }
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      const base = account ? { ...account } : { archived: false, parentId: null, subKind: null };
      const saved = await repo.upsertAccount({
        ...base, id: account?.id, name: accountName(f.bank, f.label), bank: f.bank.trim(), label: f.label.trim() || null,
        kind: f.kind, personId: f.personId || null, color: f.color,
        initialBalanceCents: account ? initialForCurrent(snap!, account, balance!) : balance!,
        overdraftCents: f.hasOverdraft ? overdraft ?? 0 : null,
        hasDebit: f.hasDebit, debitLast4: f.hasDebit ? f.debitLast4 || null : null, debitBrand: f.hasDebit ? f.debitBrand || null : null,
      });
      if (f.credit) {
        await repo.upsertCard({
          name: f.cardName.trim() || `${f.bank.trim()} crédito`, bank: f.bank.trim(), last4: f.cardLast4 || null, brand: f.cardBrand,
          limitCents: limit ?? 0, closingDay: dayOk(f.cardClosing)!, dueDay: dayOk(f.cardDue)!, color: f.cardColor,
          paymentAccountId: saved.id, personId: f.personId || null, archived: false,
        });
      }
      onSaved(account ? "Conta atualizada" : f.credit ? "Conta e cartão criados" : "Conta criada", saved.id);
      onClose();
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : "Não foi possível salvar." });
    } finally {
      setSaving(false);
    }
  }

  const err = (k: string) => errors[k];
  return (
    <Dialog onClose={onClose} title={<h2 className="text-lg font-semibold">{account ? "Editar Conta Bancária" : "Nova Conta Bancária"}</h2>}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Field label="Pessoa/Perfil *" htmlFor="acc-person">
          <select id="acc-person" className={inputClass} value={f.personId} onChange={(e) => set("personId")(e.target.value)}>
            <PersonOptions />
          </select>
        </Field>
        <Field label="Banco *" htmlFor="acc-bank" error={err("bank")}>
          <button id="acc-bank" type="button" onClick={() => setPicking(true)} aria-haspopup="dialog"
            aria-describedby={err("bank") ? "acc-bank-error" : undefined}
            className={`${inputClass} flex items-center gap-3 text-left ${err("bank") ? "border-danger" : ""}`}>
            {f.bank ? <BankDot name={f.bank} /> : null}
            <span className={`flex-1 truncate ${f.bank ? "" : "text-text-muted"}`}>{f.bank || "Selecione o banco"}</span>
            <ChevronDown aria-hidden className="size-4 text-text-muted" />
          </button>
        </Field>
        {picking && <BankPicker onClose={() => setPicking(false)} onPick={(b) => { set("bank")(b); setPicking(false); }} />}
        <Field label="Tipo de Conta" htmlFor="acc-kind">
          <select id="acc-kind" className={inputClass} value={f.kind} onChange={(e) => set("kind")(e.target.value as AccountKind)}>
            {Object.entries(ACCOUNT_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="Etiqueta (opcional)" htmlFor="acc-label" hint="Uma etiqueta ajuda a identificar a conta quando houver mais de uma.">
          <Input id="acc-label" maxLength={40} value={f.label} onChange={(e) => set("label")(e.target.value)} placeholder="Ex: Conta Principal, Reserva, Viagem..." />
        </Field>
        <Field label="Saldo Atual" htmlFor="acc-balance" error={err("balance")}>
          <MoneyInput id="acc-balance" value={f.balance} onChange={set("balance")} invalid={!!err("balance")} />
        </Field>
        <div className="flex flex-col gap-1">
          <span id="acc-color-label" className="text-xs font-semibold text-text-muted">Cor da conta</span>
          <div role="radiogroup" aria-labelledby="acc-color-label" className="flex flex-wrap gap-2">
            {Object.keys(CARD_COLORS).map((k) => (
              <button key={k} type="button" role="radio" aria-checked={f.color === k} aria-label={COLOR_NAMES[k]} onClick={() => set("color")(k)}
                className="size-8 rounded-pill ring-offset-2 ring-offset-bg aria-checked:ring-2 aria-checked:ring-text" style={{ background: CARD_COLORS[k] }} />
            ))}
          </div>
        </div>

        <Switch id="acc-has-overdraft" label="Possui cheque especial?" checked={f.hasOverdraft} onChange={set("hasOverdraft")} />
        {f.hasOverdraft && (
          <Field label="Limite do Cheque Especial" htmlFor="acc-overdraft" error={err("overdraft")}>
            <MoneyInput id="acc-overdraft" value={f.overdraft} onChange={set("overdraft")} invalid={!!err("overdraft")} />
          </Field>
        )}

        <section className="flex flex-col gap-2 border-t border-border pt-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold"><CreditCard aria-hidden className="size-4 text-text-muted" />Cartão de Débito</h3>
          <Switch id="acc-has-debit" label="Possui cartão de débito?" checked={f.hasDebit} onChange={set("hasDebit")} />
          {f.hasDebit && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Últimos 4 dígitos" htmlFor="acc-debit-last4" error={err("debitLast4")}>
                <Input id="acc-debit-last4" inputMode="numeric" maxLength={4} className="num" placeholder="1234" value={f.debitLast4}
                  onChange={(e) => set("debitLast4")(e.target.value.replace(/\D/g, ""))} aria-invalid={!!err("debitLast4") || undefined} />
              </Field>
              <Field label="Bandeira" htmlFor="acc-debit-brand">
                <select id="acc-debit-brand" className={inputClass} value={f.debitBrand} onChange={(e) => set("debitBrand")(e.target.value)}>
                  <option value="">Selecione</option>
                  {DEBIT_BRANDS.map((b) => <option key={b}>{b}</option>)}
                </select>
              </Field>
            </div>
          )}
        </section>

        <section className="flex flex-col gap-2 border-t border-border pt-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold"><CreditCard aria-hidden className="size-4 text-expense" />Cartão de Crédito</h3>
          {linkedCards.length > 0 && <p className="text-xs text-text-muted">Já ligado a esta conta: {linkedCards.map((c) => c.name).join(", ")}.</p>}
          <Switch id="acc-credit" label="Adicionar cartão de crédito?" checked={f.credit} onChange={set("credit")} />
          {f.credit && (
            <div className="flex flex-col gap-3">
              <Field label="Nome do Cartão" htmlFor="acc-card-name">
                <Input id="acc-card-name" maxLength={40} value={f.cardName} onChange={(e) => set("cardName")(e.target.value)} placeholder="Ex: Cartão Gold" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Últimos 4 dígitos" htmlFor="acc-card-last4" error={err("cardLast4")}>
                  <Input id="acc-card-last4" inputMode="numeric" maxLength={4} className="num" placeholder="5678" value={f.cardLast4}
                    onChange={(e) => set("cardLast4")(e.target.value.replace(/\D/g, ""))} aria-invalid={!!err("cardLast4") || undefined} />
                </Field>
                <Field label="Bandeira" htmlFor="acc-card-brand" error={err("cardBrand")}>
                  <select id="acc-card-brand" className={inputClass} value={f.cardBrand} onChange={(e) => set("cardBrand")(e.target.value)} aria-invalid={!!err("cardBrand") || undefined}>
                    <option value="">Selecione</option>
                    {CARD_BRANDS.map((b) => <option key={b}>{b}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Limite" htmlFor="acc-card-limit" error={err("cardLimit")}>
                <MoneyInput id="acc-card-limit" value={f.cardLimit} onChange={set("cardLimit")} invalid={!!err("cardLimit")} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Dia Fechamento" htmlFor="acc-card-closing" error={err("cardClosing")}>
                  <Input id="acc-card-closing" inputMode="numeric" maxLength={2} className="num" placeholder="10" value={f.cardClosing}
                    onChange={(e) => set("cardClosing")(e.target.value.replace(/\D/g, ""))} aria-invalid={!!err("cardClosing") || undefined} />
                </Field>
                <Field label="Dia Vencimento" htmlFor="acc-card-due" error={err("cardDue")}>
                  <Input id="acc-card-due" inputMode="numeric" maxLength={2} className="num" placeholder="17" value={f.cardDue}
                    onChange={(e) => set("cardDue")(e.target.value.replace(/\D/g, ""))} aria-invalid={!!err("cardDue") || undefined} />
                </Field>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="acc-card-color" className="text-xs font-semibold text-text-muted">Cor do Cartão</label>
                <ColorSelect id="acc-card-color" value={f.cardColor} onChange={set("cardColor")} />
              </div>
            </div>
          )}
        </section>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-text-muted">Prévia</span>
          <AccountBanner bank={f.bank.trim()} kind={ACCOUNT_KINDS[f.kind] + (f.label.trim() ? ` · ${f.label.trim()}` : "")} color={f.color} />
        </div>
        {errors.form && <p role="alert" className="text-sm text-danger">{errors.form}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={saving}>Salvar</Button>
        </div>
      </form>
    </Dialog>
  );
}

/** "Nova Subconta": poupança ou caixinha dentro de uma conta. */
export function SubaccountModal({ parent, onClose, onSaved }: { parent: Account; onClose: () => void; onSaved: (msg: string) => void }) {
  const [subKind, setSubKind] = useState<"poupanca" | "caixinha">("poupanca");
  const [name, setName] = useState("");
  const [initial, setInitial] = useState("");
  const [color, setColor] = useState(SUB_COLORS[0]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const cents = money(initial);
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Dê um nome para a subconta.";
    if (cents == null || cents < 0) errs.initial = "Valor inválido.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      await repo.upsertAccount({
        name: name.trim(), kind: subKind === "poupanca" ? "savings" : "other", initialBalanceCents: cents!, archived: false,
        parentId: parent.id, subKind, color, bank: null, label: null, personId: parent.personId ?? null, overdraftCents: null, hasDebit: false,
      });
      onSaved("Subconta criada");
      onClose();
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : "Não foi possível salvar." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog onClose={onClose} title={<><h2 className="text-lg font-semibold">Nova Subconta</h2><p className="text-sm text-text-muted">Vinculada a: {accountTitle(parent)}</p></>}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-text-muted">Tipo de Subconta</span>
          <Segmented label="Tipo de Subconta" value={subKind} onChange={setSubKind}
            options={[{ value: "poupanca", label: "Poupança" }, { value: "caixinha", label: "Caixinha" }]} />
        </div>
        <Field label="Nome" htmlFor="sub-name" error={errors.name}>
          <Input id="sub-name" autoFocus maxLength={40} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Poupança"
            aria-invalid={!!errors.name || undefined} aria-describedby={errors.name ? "sub-name-error" : undefined} />
        </Field>
        <Field label="Saldo Inicial" htmlFor="sub-initial" error={errors.initial}>
          <MoneyInput id="sub-initial" value={initial} onChange={setInitial} invalid={!!errors.initial} />
        </Field>
        <div className="flex flex-col gap-1">
          <span id="sub-color-label" className="text-xs font-semibold text-text-muted">Cor</span>
          <div role="radiogroup" aria-labelledby="sub-color-label" className="flex flex-wrap gap-2">
            {SUB_COLORS.map((c, i) => (
              <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={`Cor ${i + 1}`} onClick={() => setColor(c)}
                className="size-8 rounded-pill ring-offset-2 ring-offset-bg aria-checked:ring-2 aria-checked:ring-text" style={{ background: c }} />
            ))}
          </div>
        </div>
        {errors.form && <p role="alert" className="text-sm text-danger">{errors.form}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={saving}>Criar Subconta</Button>
        </div>
      </form>
    </Dialog>
  );
}

/** "Recalcular": mostra a conta do saldo e deixa acertar com o saldo real do banco. */
export function RecalcModal({ account, onClose, onSaved }: { account: Account; onClose: () => void; onSaved: (msg: string) => void }) {
  const snap = useSnapshot();
  const [real, setReal] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  if (!snap) return null;
  const b = balanceBreakdown(snap, account);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const cents = money(real, true);
    if (!real.trim() || cents == null) return setError("Informe o saldo que aparece no banco.");
    setSaving(true);
    try {
      await repo.upsertAccount({ ...account, initialBalanceCents: initialForCurrent(snap!, account, cents) });
      onSaved("Saldo ajustado");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  const row = (label: string, v: string, strong = false) => (
    <div className={`flex justify-between py-1.5 ${strong ? "border-t border-border pt-2 font-bold" : ""}`}><span>{label}</span><span className="num">{v}</span></div>
  );
  return (
    <Dialog onClose={onClose} title={<h2 className="text-lg font-semibold">Recalcular saldo</h2>}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <p className="text-sm text-text-muted">O saldo é refeito com todos os lançamentos pagos desta conta.</p>
        <div className="rounded-md bg-surface p-3 text-sm">
          {row("Saldo inicial", formatBRL(b.initialCents))}
          {row("Entradas", `+ ${formatBRL(b.inCents)}`)}
          {row("Saídas", `− ${formatBRL(b.outCents)}`)}
          {row("Saldo calculado", formatBRL(b.totalCents), true)}
        </div>
        <Field label="Saldo no banco hoje (opcional)" htmlFor="recalc-real" error={error} hint="Se for diferente, o app acerta o saldo inicial sem mexer nos lançamentos.">
          <MoneyInput id="recalc-real" value={real} onChange={setReal} invalid={!!error} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Fechar</Button>
          <Button type="submit" loading={saving} disabled={!real.trim()}>Ajustar saldo</Button>
        </div>
      </form>
    </Dialog>
  );
}

/** "Excluir conta?": a conta e as subcontas saem das listas; os lançamentos continuam no histórico. */
export function DeleteAccountDialog({ account, onClose, onDeleted }: { account: Account; onClose: () => void; onDeleted: () => void }) {
  const snap = useSnapshot();
  const [saving, setSaving] = useState(false);
  const subs = snap ? subaccounts(snap, account.id) : [];
  async function confirm() {
    setSaving(true);
    try {
      for (const s of subs) await repo.upsertAccount({ ...s, archived: true });
      await repo.upsertAccount({ ...account, archived: true });
      onDeleted();
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog onClose={onClose} title={<h2 className="text-lg font-semibold">Excluir conta?</h2>}>
      <p className="text-sm">A conta <strong>{accountTitle(account)}</strong>{subs.length ? ` e ${subs.length === 1 ? "a subconta" : `as ${subs.length} subcontas`}` : ""} vai sair das suas listas.</p>
      <p className="mt-2 text-sm text-text-muted">Os lançamentos já feitos continuam no histórico.</p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button variant="danger" loading={saving} onClick={confirm}>Excluir</Button>
      </div>
    </Dialog>
  );
}
