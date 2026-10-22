"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { categoryFits } from "@/lib/categories";
import { repo, useSnapshot } from "@/lib/data";
import { formatBRL, parseBRL, splitInstallments } from "@/lib/money";
import { monthLabel, statementMonthFor, today } from "@/lib/dates";
import { categoryUsage } from "@/lib/summary";
import { ValidationError } from "@/lib/transactions";
import type { TransactionKind } from "@/lib/types";
import { Button, Field, Input, Segmented, inputClass } from "./ui";

type Kind = Extract<TransactionKind, "expense" | "income" | "transfer">;

export function TransactionModal({ initialKind = "expense", onClose, onSaved }:
  { initialKind?: Kind; onClose: () => void; onSaved: (msg: string, undo?: () => void) => void }) {
  const snap = useSnapshot();
  const [kind, setKind] = useState<Kind>(initialKind);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [payWith, setPayWith] = useState<"account" | "card">("account");
  const [accountId, setAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [cardId, setCardId] = useState("");
  const [personId, setPersonId] = useState<string | null>(null); // null: segue a pessoa do cartão
  const [date, setDate] = useState(today());
  const [installments, setInstallments] = useState(1);
  const [paid, setPaid] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [key] = useState(() => crypto.randomUUID());
  const amountRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const accounts = snap?.accounts.filter((a) => !a.archived) ?? [];
  const cards = snap?.cards.filter((c) => !c.archived) ?? [];
  const categories = snap?.categories.filter((c) => !c.archived && categoryFits(c, kind === "income" ? "income" : "expense")) ?? [];
  const people = snap?.people.filter((p) => !p.archived) ?? [];

  useEffect(() => { amountRef.current?.focus(); }, []);
  const sourceAccount = accountId || accounts[0]?.id || "";
  const sourceCard = cardId || cards[0]?.id || "";

  const dirty = amount !== "" || description !== "";
  const close = () => { if (!dirty || confirm("Descartar este lançamento?")) onClose(); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); close(); }
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

  const cents = parseBRL(amount);
  const usingCard = kind === "expense" && payWith === "card";
  const card = cards.find((c) => c.id === sourceCard);
  const statement = usingCard && card ? statementMonthFor(date, card.closingDay) : null;
  const chosenPerson = personId ?? (usingCard && card?.personId ? card.personId : "");

  const limitWarning = (() => {
    if (!snap || kind !== "expense" || !categoryId || !cents) return null;
    const month = statement ?? date.slice(0, 8) + "01";
    const u = categoryUsage(snap, month).find((x) => x.categoryId === categoryId);
    const cat = snap.categories.find((c) => c.id === categoryId);
    if (!u?.limitCents || !cat) return null;
    const after = (u.spentCents + cents) / u.limitCents;
    if (after < 0.8) return null;
    return after > 1
      ? `Com este gasto, ${cat.name} passa ${formatBRL(u.spentCents + cents - u.limitCents)} do limite.`
      : `Com este gasto, você chega a ${Math.round(after * 100)}% do limite de ${cat.name}.`;
  })();

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!cents) errs.amount = "Informe um valor, por exemplo 25,90.";
    if (kind === "expense" && usingCard && !card) errs.source = "Cadastre um cartão primeiro.";
    if (kind === "transfer" && (!toAccountId || toAccountId === sourceAccount)) errs.source = "Escolha uma conta de destino diferente.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      const rows = await repo.createTransaction({
        kind, amountCents: cents!, occurredOn: date, description,
        categoryId: kind === "transfer" ? null : categoryId || null,
        accountId: usingCard ? null : sourceAccount, toAccountId: kind === "transfer" ? toAccountId : null,
        cardId: usingCard ? sourceCard : null, personId: chosenPerson || null,
        installments: usingCard ? installments : 1,
        isPaid: usingCard || kind === "transfer" ? true : paid,
        dueOn: paid ? null : date,
        idempotencyKey: key,
      });
      onClose();
      const first = rows[0];
      onSaved(rows.length > 1 ? `${rows.length} parcelas salvas` : "Lançamento salvo",
        first ? () => repo.purgeTransactions(rows.map((r) => r.id)) : undefined);
    } catch (err) {
      setErrors({ form: err instanceof ValidationError || err instanceof Error ? err.message : "Não deu para salvar. Tente de novo." });
      setSaving(false);
    }
  }

  const title = { expense: "Nova despesa", income: "Nova receita", transfer: "Nova transferência" }[kind];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-center">
      <button aria-label="Fechar" tabIndex={-1} className="absolute inset-0 bg-text/40" onClick={close} />
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="tx-title"
        className="relative flex max-h-dvh w-full flex-col overflow-y-auto rounded-t-lg bg-bg shadow-pop lg:w-[480px] lg:rounded-lg">
        <form onSubmit={submit} noValidate className="flex flex-col gap-4 p-5">
          <div className="flex items-center justify-between">
            <h2 id="tx-title" className="text-lg font-semibold">{title}</h2>
            <button type="button" onClick={close} aria-label="Fechar" className="rounded-sm p-2 hover:bg-surface"><X className="size-5" /></button>
          </div>

          <Segmented label="Tipo" value={kind} onChange={(k) => { setKind(k); setCategoryId(""); }}
            options={[{ value: "expense", label: "Despesa" }, { value: "income", label: "Receita" }, { value: "transfer", label: "Transferência" }]} />

          <Field label="Valor" htmlFor="tx-amount" error={errors.amount}>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xl font-semibold text-text-muted">R$</span>
              <input id="tx-amount" ref={amountRef} inputMode="decimal" autoComplete="off" placeholder="0,00" value={amount}
                onChange={(e) => setAmount(e.target.value)}
                aria-invalid={!!errors.amount} aria-describedby={errors.amount ? "tx-amount-error" : undefined}
                className={`${inputClass.replace("px-3", "pl-14 pr-3")} num h-14 text-xl font-bold ${kind === "expense" ? "text-expense" : kind === "income" ? "text-income" : ""}`} />
            </div>
          </Field>

          <Field label="Descrição" htmlFor="tx-desc">
            <Input id="tx-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={kind === "income" ? "Ex.: salário" : "Ex.: mercado do mês"} maxLength={120} />
          </Field>

          {kind !== "transfer" && (
            <Field label="Categoria" htmlFor="tx-cat" error={limitWarning ?? undefined}>
              <select id="tx-cat" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputClass}>
                <option value="">Sem categoria</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
          )}

          {kind === "expense" && (
            <Segmented label="Pagar com" value={payWith} onChange={setPayWith}
              options={[{ value: "account", label: "Conta" }, { value: "card", label: "Cartão de crédito" }]} />
          )}

          {usingCard ? (
            cards.length ? (
              <div className="grid grid-cols-[1fr_auto] gap-3">
                <Field label="Cartão" htmlFor="tx-card" error={errors.source} hint={statement ? `Cai na fatura de ${monthLabel(statement)}` : undefined}>
                  <select id="tx-card" value={sourceCard} onChange={(e) => setCardId(e.target.value)} className={inputClass}>
                    {cards.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </Field>
                <Field label="Parcelas" htmlFor="tx-inst" hint={cents && installments > 1 ? `${installments}x de ${formatBRL(splitInstallments(cents, installments)[1])}` : undefined}>
                  <select id="tx-inst" value={installments} onChange={(e) => setInstallments(Number(e.target.value))} className={`${inputClass} w-24`}>
                    {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n === 1 ? "À vista" : `${n}x`}</option>)}
                  </select>
                </Field>
              </div>
            ) : <p className="rounded-md bg-warning-soft p-3 text-sm text-warning">Você ainda não tem cartões. Cadastre um em Cartões.</p>
          ) : (
            <div className={kind === "transfer" ? "grid grid-cols-2 gap-3" : ""}>
              <Field label={kind === "transfer" ? "De" : kind === "income" ? "Recebido em" : "Conta"} htmlFor="tx-acc">
                <select id="tx-acc" value={sourceAccount} onChange={(e) => setAccountId(e.target.value)} className={inputClass}>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </Field>
              {kind === "transfer" && (
                <Field label="Para" htmlFor="tx-to" error={errors.source}>
                  <select id="tx-to" value={toAccountId} onChange={(e) => setToAccountId(e.target.value)} className={inputClass}>
                    <option value="">Escolha</option>
                    {accounts.filter((a) => a.id !== sourceAccount).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </Field>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label={paid || usingCard || kind === "transfer" ? "Data" : "Vencimento"} htmlFor="tx-date">
              <Input id="tx-date" type="date" value={date} onChange={(e) => setDate(e.target.value || today())} />
            </Field>
            {people.length > 0 && kind !== "transfer" && (
              <Field label={kind === "income" ? "Quem recebeu" : "Quem gastou"} htmlFor="tx-person">
                <select id="tx-person" value={chosenPerson} onChange={(e) => setPersonId(e.target.value)} className={inputClass}>
                  <option value="">Ninguém em especial</option>
                  {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
            )}
          </div>

          {kind !== "transfer" && !usingCard && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} className="size-4 accent-[var(--color-accent)]" />
              {kind === "income" ? "Já recebi" : "Já paguei"}
            </label>
          )}

          {errors.form && <p role="alert" className="rounded-md bg-danger-soft p-3 text-sm text-danger">{errors.form}</p>}

          <Button type="submit" size="lg" loading={saving}>Salvar</Button>
        </form>
      </div>
    </div>
  );
}
