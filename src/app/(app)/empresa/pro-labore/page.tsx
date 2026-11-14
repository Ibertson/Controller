"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Building2, Lightbulb, Plus, Trash2, TrendingUp } from "lucide-react";
import { useShell } from "@/components/AppShell";
import { useSpace } from "@/components/business";
import { Dialog } from "@/components/Dialog";
import { Button, Card, Field, Input, Skeleton, inputClass } from "@/components/ui";
import { repo, useSnapshot } from "@/lib/data";
import { today } from "@/lib/dates";
import { formatBRL, parseBRL } from "@/lib/money";
import { PCT_MAX, PCT_MIN, clampPct, monthName, suggested, withdrawalDay, withdrawnPct } from "@/lib/prolabore";
import { monthTotals } from "@/lib/summary";
import type { ProLaboreWithdrawal, Snapshot } from "@/lib/types";

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const CATEGORY = "Pró-labore";
const pctText = (n: number | null) => (n == null ? "—" : `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`);
const revenueOf = (snap: Snapshot, month: string) => monthTotals(snap, `${month}-01`).incomeCents;

/** Retiradas e contas pessoais (recarrega ao trocar de espaço). */
function useProLabore() {
  const wsId = useSnapshot()?.workspace.id;
  const [state, setState] = useState<{ ws?: string; list?: ProLaboreWithdrawal[]; personal?: { id: string; name: string }[]; error?: string }>({});
  useEffect(() => {
    if (!wsId) return;
    let alive = true;
    Promise.all([repo.listProLabore(), repo.personalAccounts().catch(() => [])])
      .then(([list, personal]) => { if (alive) setState({ ws: wsId, list, personal }); })
      .catch((e) => { if (alive) setState({ ws: wsId, list: [], personal: [], error: e instanceof Error ? e.message : "Não foi possível carregar." }); });
    return () => { alive = false; };
  }, [wsId]);
  const ready = state.ws === wsId ? state : {};
  return { list: ready.list, personal: ready.personal ?? [], error: ready.error, setList: (list: ProLaboreWithdrawal[]) => setState((s) => ({ ...s, ws: wsId, list })) };
}

/** Pró-Labore: quanto o dono pode retirar do faturamento e o histórico das retiradas. */
export default function ProLabore() {
  const { kind, company } = useSpace();
  const snap = useSnapshot();
  const { toast } = useShell();
  const { list, personal, error, setList } = useProLabore();
  const now = today();
  const [month, setMonth] = useState(now.slice(0, 7));
  const [pct, setPct] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [removing, setRemoving] = useState<ProLaboreWithdrawal | null>(null);
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState("");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const months = useRef<HTMLElement>(null);
  useEffect(() => { months.current?.querySelector<HTMLElement>("[aria-pressed=true]")?.scrollIntoView({ block: "nearest", inline: "center" }); }, [kind]);

  if (kind !== "business" || !company) {
    return (
      <Card className="flex flex-col items-center gap-3 py-10 text-center">
        <Building2 aria-hidden className="size-9 text-text-muted" />
        <h1 className="font-semibold">Pró-Labore faz parte do Painel Empresarial</h1>
        <p className="max-w-md text-sm text-text-muted">Abra a aba Empresarial no topo da tela para acompanhar a sua retirada mensal.</p>
      </Card>
    );
  }
  if (!list || !snap) return <div className="flex flex-col gap-4"><Skeleton className="h-20" /><Skeleton className="h-56" /><Skeleton className="h-40" /></div>;

  const mei = company.companyType === "mei";
  const p = pct ?? clampPct(company.details?.proLaborePct);
  const revenue = revenueOf(snap, month);
  const value = suggested(revenue, p);
  const withdrawn = list.filter((w) => w.month === month).reduce((t, w) => t + w.amountCents, 0);
  const isCurrent = month === now.slice(0, 7);
  const history = [...list].sort((a, b) => b.month.localeCompare(a.month) || b.createdAt.localeCompare(a.createdAt));

  function changePct(n: number) {
    setPct(n);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void repo.updateCompany({ ...company!, details: { ...company!.details, proLaborePct: n } }).catch(() => toast("Não foi possível guardar o percentual."));
    }, 600);
  }

  async function remove(w: ProLaboreWithdrawal) {
    setBusy(true); setFail("");
    try {
      if (w.expenseTxId) await repo.trashTransactions([w.expenseTxId]);
      if (w.personalTxId) await repo.trashPersonal(w.personalTxId);
      await repo.deleteProLabore(w.id);
      setList(list!.filter((x) => x.id !== w.id));
      toast("Retirada excluída");
    } catch (x) { setFail(x instanceof Error ? x.message : "Não foi possível excluir."); }
    finally { setBusy(false); setRemoving(null); }
  }

  // Anel do percentual (0 a 100%).
  const R = 42, C = 2 * Math.PI * R;
  const tips = [
    "O pró-labore é a remuneração do proprietário pelo trabalho realizado na empresa.",
    mei ? "Para o MEI, não há obrigatoriedade de retirada de pró-labore, mas é recomendado separar as finanças pessoais das empresariais."
      : "Fora do MEI, o pró-labore entra na folha e tem contribuição ao INSS. Confirme os valores com o seu contador.",
    "Sugerimos entre 30% e 40% do faturamento, mas ajuste conforme suas necessidades e despesas.",
    "Mantenha sempre uma reserva na empresa para despesas futuras e emergências.",
  ];

  return (
    <div className="flex flex-col gap-4">
      <nav ref={months} aria-label="Mês" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {MONTHS.map((m, i) => {
          const key = `${now.slice(0, 4)}-${String(i + 1).padStart(2, "0")}`;
          return (
            <button key={key} type="button" aria-pressed={month === key} onClick={() => setMonth(key)}
              className="h-9 shrink-0 rounded-md border border-border px-4 text-sm hover:bg-surface aria-pressed:border-accent aria-pressed:bg-accent-soft aria-pressed:font-semibold aria-pressed:text-accent">{m}</button>
          );
        })}
      </nav>

      <Card>
        <h1 className="text-2xl font-bold">Pró-Labore</h1>
        <p className="text-sm text-text-muted">Gerencie sua retirada mensal {mei ? "como MEI" : "da empresa"}</p>
      </Card>

      {error && <p role="alert" className="text-sm text-danger">{error}</p>}

      <Card className="flex flex-col items-center gap-5 bg-accent-soft/40 sm:flex-row sm:items-center">
        <div className="relative grid size-28 shrink-0 place-items-center">
          <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90" aria-hidden>
            <circle cx="50" cy="50" r={R} fill="none" strokeWidth="9" className="stroke-border" />
            <circle cx="50" cy="50" r={R} fill="none" strokeWidth="9" strokeLinecap="round" className="stroke-accent transition-all"
              strokeDasharray={`${(C * p) / 100} ${C}`} />
          </svg>
          <span className="num text-2xl font-bold">{p}%</span>
        </div>
        <div className="flex w-full min-w-0 flex-1 flex-col gap-2">
          <h2 className="flex items-center gap-2 font-semibold"><TrendingUp aria-hidden className="size-4 text-accent" />Valor sugerido {isCurrent ? "este mês" : `em ${monthName(month)}`}</h2>
          <p className="num text-3xl font-bold text-accent">{formatBRL(value)}</p>
          <p className="text-sm text-text-muted">Baseado em {p}% do seu faturamento de <span className="num">{formatBRL(revenue)}</span></p>
          {withdrawn > 0 && <p className="text-sm">Já retirado {isCurrent ? "este mês" : "no mês"}: <strong className="num">{formatBRL(withdrawn)}</strong></p>}
          <label htmlFor="pl-pct" className="mt-1 text-xs text-text-muted">Ajustar percentual de retirada: {p}%</label>
          <input id="pl-pct" type="range" min={PCT_MIN} max={PCT_MAX} step={1} value={p} onChange={(e) => changePct(Number(e.target.value))}
            className="w-full accent-[var(--color-accent)]" aria-valuetext={`${p}%`} />
          <div className="flex justify-between text-xs text-text-muted"><span>{PCT_MIN}%</span><span>{PCT_MAX}%</span></div>
          <Button onClick={() => setOpen(true)} className="mt-1 self-start rounded-pill"><Plus aria-hidden className="size-4" />Registrar retirada</Button>
        </div>
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 font-semibold"><Lightbulb aria-hidden className="size-5 text-warning" />Dicas sobre Pró-Labore</h2>
        <ul className="flex list-disc flex-col gap-2 pl-5 text-sm marker:text-accent">
          {tips.map((t) => <li key={t}>{t}</li>)}
        </ul>
      </Card>

      {fail && <p role="alert" className="text-sm text-danger">{fail}</p>}

      <Card className="flex flex-col gap-3">
        <h2 className="font-semibold">Histórico de retiradas</h2>
        <table className="hidden w-full text-sm sm:table">
          <thead>
            <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-text-muted">
              <th scope="col" className="py-2 pr-2">Mês</th><th scope="col" className="py-2 pr-2">Faturamento</th><th scope="col" className="py-2 pr-2">Valor retirado</th>
              <th scope="col" className="py-2 pr-2">% Retirada</th><th scope="col" className="py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 ? (
              <tr><td colSpan={5} className="py-6 text-center text-text-muted">Nenhuma retirada registrada ainda.</td></tr>
            ) : history.map((w) => (
              <tr key={w.id} className="border-b border-border last:border-0">
                <td className="py-2.5 pr-2">{monthName(w.month)}{w.personalAccountName && <span className="block text-xs text-text-muted">Creditado em {w.personalAccountName}</span>}</td>
                <td className="num py-2.5 pr-2">{formatBRL(w.revenueCents)}</td>
                <td className="num py-2.5 pr-2 font-semibold">{formatBRL(w.amountCents)}</td>
                <td className="num py-2.5 pr-2">{pctText(withdrawnPct(w.amountCents, w.revenueCents))}</td>
                <td className="py-2.5 text-right">
                  <button type="button" onClick={() => setRemoving(w)} aria-label={`Excluir retirada de ${monthName(w.month)} de ${formatBRL(w.amountCents)}`}
                    className="rounded-sm p-2 text-text-muted hover:bg-danger-soft hover:text-danger"><Trash2 className="size-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <ul className="flex flex-col divide-y divide-border sm:hidden">
          {history.length === 0 && <li className="py-6 text-center text-sm text-text-muted">Nenhuma retirada registrada ainda.</li>}
          {history.map((w) => (
            <li key={w.id} className="flex items-center gap-3 py-3">
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{monthName(w.month)}</span>
                <span className="block text-xs text-text-muted">Faturamento <span className="num">{formatBRL(w.revenueCents)}</span> · {pctText(withdrawnPct(w.amountCents, w.revenueCents))}</span>
                {w.personalAccountName && <span className="block text-xs text-text-muted">Creditado em {w.personalAccountName}</span>}
              </span>
              <span className="num font-semibold">{formatBRL(w.amountCents)}</span>
              <button type="button" onClick={() => setRemoving(w)} aria-label={`Excluir retirada de ${monthName(w.month)} de ${formatBRL(w.amountCents)}`}
                className="rounded-sm p-2 text-text-muted hover:bg-danger-soft hover:text-danger"><Trash2 className="size-4" /></button>
            </li>
          ))}
        </ul>
      </Card>

      {open && (
        <WithdrawDialog snap={snap} personal={personal} month={month} suggestedCents={Math.max(0, value - withdrawn)} onClose={() => setOpen(false)}
          onSaved={(w) => { setList([...list, w]); setOpen(false); setMonth(w.month); }} />
      )}
      {removing && (
        <Dialog onClose={() => setRemoving(null)} title={<h2 className="text-lg font-bold">Excluir retirada?</h2>}>
          <p className="text-sm text-text-muted">
            A retirada de {formatBRL(removing.amountCents)} em {monthName(removing.month)} sai do histórico, e a despesa da empresa{removing.personalTxId ? " e a receita na conta pessoal vão" : " vai"} para a lixeira de Transações.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRemoving(null)}>Cancelar</Button>
            <Button variant="danger" loading={busy} onClick={() => void remove(removing)}>Excluir</Button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

function WithdrawDialog({ snap, personal, month, suggestedCents, onClose, onSaved }: {
  snap: Snapshot; personal: { id: string; name: string }[]; month: string; suggestedCents: number; onClose: () => void; onSaved: (w: ProLaboreWithdrawal) => void;
}) {
  const { toast } = useShell();
  const accounts = snap.accounts.filter((a) => !a.archived);
  const [f, setF] = useState({
    value: suggestedCents ? formatBRL(suggestedCents).replace(/^R\$\s*/, "") : "", source: accounts.length === 1 ? accounts[0].id : "", dest: "",
    month: String(Number(month.slice(5))), year: month.slice(0, 4),
  });
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: string) => { setF((x) => ({ ...x, [k]: v })); setErr({}); };

  async function save() {
    const e: Record<string, string> = {};
    const cents = parseBRL(f.value);
    const m = Number(f.month), y = Number(f.year);
    if (cents == null || cents <= 0) e.value = "Informe o valor retirado.";
    if (!f.source) e.source = accounts.length ? "Escolha a conta de onde sai o dinheiro." : "Cadastre uma conta primeiro.";
    if (!(m >= 1 && m <= 12)) e.month = "Mês de 1 a 12.";
    if (!(y >= 2000 && y <= 2100)) e.year = "Ano inválido.";
    setErr(e);
    if (Object.keys(e).length) return;
    const ref = `${y}-${String(m).padStart(2, "0")}`;
    const day = withdrawalDay(ref, today());
    const label = `Pró-labore ${String(m).padStart(2, "0")}/${y}`;
    setBusy(true);
    let expenseId: string | null = null;
    try {
      let cat = snap.categories.find((c) => !c.archived && c.kind !== "income" && /^pr[oó]-?labore$/i.test(c.name.trim()));
      if (!cat) cat = await repo.upsertCategory({ name: CATEGORY, icon: "hand-coins", kind: "expense", monthlyLimitCents: null, archived: false, color: null, parentId: null });
      const [tx] = await repo.createTransaction({ kind: "expense", amountCents: cents!, occurredOn: day, description: label, accountId: f.source, categoryId: cat.id, isPaid: true });
      expenseId = tx.id;
      let personalTxId: string | null = null;
      const dest = personal.find((a) => a.id === f.dest);
      if (dest) personalTxId = await repo.creditPersonal({ accountId: dest.id, amountCents: cents!, occurredOn: day, description: label });
      const w: ProLaboreWithdrawal = {
        id: crypto.randomUUID(), month: ref, amountCents: cents!, revenueCents: revenueOf(snap, ref), expenseTxId: expenseId,
        personalTxId, personalAccountName: dest?.name ?? "", createdAt: new Date().toISOString(),
      };
      await repo.saveProLabore(w);
      toast("Retirada registrada");
      onSaved(w);
    } catch (x) {
      // Não deixa despesa solta se o resto falhou.
      if (expenseId) await repo.trashTransactions([expenseId]).catch(() => undefined);
      setErr({ form: x instanceof Error ? x.message : "Não foi possível registrar." });
    } finally { setBusy(false); }
  }

  return (
    <Dialog onClose={onClose} title={<h2 className="text-lg font-bold">Registrar Retirada de Pró-Labore</h2>}>
      <form onSubmit={(e) => { e.preventDefault(); void save(); }} noValidate className="flex flex-col gap-4">
        <Field label="Valor retirado" htmlFor="pl-value" error={err.value}>
          <div className="relative">
            <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-muted">R$</span>
            <Input id="pl-value" autoFocus inputMode="decimal" placeholder="0,00" className="num pl-10" value={f.value}
              onChange={(e) => set("value", e.target.value.replace(/[^\d,.]/g, ""))} aria-invalid={!!err.value || undefined} />
          </div>
        </Field>
        <Field label="Conta de origem *" htmlFor="pl-source" error={err.source}>
          <select id="pl-source" value={f.source} onChange={(e) => set("source", e.target.value)} className={inputClass} aria-invalid={!!err.source || undefined}>
            <option value="" disabled>Selecione a conta</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          {accounts.length === 0 && (
            <p className="text-xs text-danger">Nenhuma conta bancária cadastrada. <Link href="/contas" className="font-semibold underline">Cadastre uma conta primeiro.</Link></p>
          )}
        </Field>
        <Field label="Conta pessoal de destino (opcional)" htmlFor="pl-dest" hint="Se escolher uma conta, o valor entra como receita na sua conta pessoal.">
          <select id="pl-dest" value={f.dest} onChange={(e) => set("dest", e.target.value)} className={inputClass}>
            <option value="">Não creditar em nenhuma conta</option>
            {personal.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Mês" htmlFor="pl-month" error={err.month}>
            <Input id="pl-month" type="number" inputMode="numeric" min={1} max={12} className="num" value={f.month} onChange={(e) => set("month", e.target.value)} />
          </Field>
          <Field label="Ano" htmlFor="pl-year" error={err.year}>
            <Input id="pl-year" type="number" inputMode="numeric" min={2000} max={2100} className="num" value={f.year} onChange={(e) => set("year", e.target.value)} />
          </Field>
        </div>
        {err.form && <p role="alert" className="text-sm text-danger">{err.form}</p>}
        <Button type="submit" size="lg" loading={busy} className="w-full rounded-pill">Confirmar Retirada</Button>
      </form>
    </Dialog>
  );
}
