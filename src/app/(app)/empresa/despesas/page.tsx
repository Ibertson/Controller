"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Building2, Check, CloudUpload, FileText, Filter, Layers, Minus, Package, Paperclip, Plus, ReceiptText, Trash2, UserRound, X } from "lucide-react";
import { useShell } from "@/components/AppShell";
import { useSpace } from "@/components/business";
import { Dialog } from "@/components/Dialog";
import { useExpenseDetails } from "@/components/expenses";
import { Button, Card, Field, Input, Skeleton, inputClass } from "@/components/ui";
import { repo, useSnapshot } from "@/lib/data";
import { addMonthsToDay, daysInMonth, today } from "@/lib/dates";
import {
  BUSINESS_CATEGORIES, EXPENSE_TYPES, PAYMENT_METHODS, PAYROLL_CATEGORY, byCategory, expenseDescription, findCategoryByName, receiptError, splitCents, distinct, emptyAdvanced, expenseRows, expenseSummary, expenseTypeLabel, filterExpenses,
  type ExpenseRow, type PaymentMethod, type QuickFilter,
} from "@/lib/expenses";
import { formatBRL, parseBRL } from "@/lib/money";
import type { Category, ExpenseDetail, ExpenseType } from "@/lib/types";

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const NEW_SUPPLIER = "__novo__";
const dateBR = (d: string) => d.split("-").reverse().join("/");
type Advanced = typeof emptyAdvanced | { from: string; to: string; categoryId: string; employee: string; supplier: string; status: "all" | "paid" | "pending" };

const QUICK: { id: QuickFilter; label: string }[] = [
  { id: "all", label: "Todos" }, { id: "pending", label: "Pendentes" }, { id: "overdue", label: "Vencidas" },
  { id: "due7", label: "Vence em 7 dias" }, { id: "due30", label: "Vence em 30 dias" },
];
const TYPE_ICON: Record<ExpenseType, React.ReactNode> = {
  despesa: <ReceiptText aria-hidden className="size-4" />, compra: <Package aria-hidden className="size-4" />, folha: <UserRound aria-hidden className="size-4" />,
};

/** Nome da categoria com a mãe na frente ("Pessoal › Salários"). */
function categoryName(c: Category | undefined, all: Map<string, Category>): string {
  if (!c) return "";
  const parent = c.parentId ? all.get(c.parentId) : undefined;
  return parent ? `${parent.name} › ${c.name}` : c.name;
}

/** Despesas / Compras: tudo o que a empresa gasta, com o que falta pagar e o que já venceu. */
export default function DespesasCompras() {
  const { kind } = useSpace();
  const { toast } = useShell();
  const snap = useSnapshot();
  const { list: details, error, setList: setDetails } = useExpenseDetails();
  const now = today();
  const year = now.slice(0, 4);
  const [month, setMonth] = useState(now.slice(0, 7));
  const [type, setType] = useState<ExpenseType | "all">("all");
  const [quick, setQuick] = useState<QuickFilter>("all");
  const [adv, setAdv] = useState<Advanced>(emptyAdvanced);
  const [open, setOpen] = useState<"new" | "filters" | null>(null);
  const [fail, setFail] = useState("");
  const months = useRef<HTMLElement>(null);
  useEffect(() => { months.current?.querySelector<HTMLElement>("[aria-pressed=true]")?.scrollIntoView({ block: "nearest", inline: "center" }); }, [kind]);

  if (kind !== "business") {
    return (
      <Card className="flex flex-col items-center gap-3 py-10 text-center">
        <Building2 aria-hidden className="size-9 text-text-muted" />
        <h1 className="font-semibold">Despesas / Compras faz parte do Painel Empresarial</h1>
        <p className="max-w-md text-sm text-text-muted">Abra a aba Empresarial no topo da tela para controlar os custos da sua empresa.</p>
      </Card>
    );
  }
  if (!snap || !details) return <div className="flex flex-col gap-4"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-64" /></div>;

  const cats = new Map(snap.categories.map((c) => [c.id, c]));
  const all = expenseRows(snap.transactions, details, now);
  const base = { month, ...adv };
  const period = filterExpenses(all, { ...base, type: "all", quick: "all" }, now);
  const s = expenseSummary(period, all);
  const shown = filterExpenses(all, { ...base, type, quick }, now);
  const chart = byCategory(shown, snap.categories);
  const chartMax = Math.max(1, ...chart.map((c) => c.cents));
  const shownTotal = shown.reduce((t, r) => t + r.t.amountCents, 0);
  const advActive = adv.from || adv.to || adv.categoryId || adv.employee || adv.supplier || adv.status !== "all";
  const whose = snap.workspace.companyType === "mei" ? "do seu MEI" : "da sua empresa";

  async function pay(r: ExpenseRow) {
    setFail("");
    try { await repo.markPaid(r.t.id); toast("Marcada como paga"); }
    catch (e) { setFail(e instanceof Error ? e.message : "Não foi possível marcar como paga."); }
  }
  async function remove(r: ExpenseRow) {
    setFail("");
    try { await repo.deleteTransaction(r.t.id, "one"); toast("Enviada para a lixeira de Transações"); }
    catch (e) { setFail(e instanceof Error ? e.message : "Não foi possível excluir."); }
  }

  const stat = (label: React.ReactNode, value: string, sub: string | null, tone: string) => (
    <div className={`flex min-w-0 flex-col gap-0.5 rounded-lg p-3 sm:p-4 ${tone}`}>
      <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide">{label}</span>
      <span className="num break-words text-lg font-bold leading-tight text-text">{value}</span>
      {sub && <span className="text-xs text-text-muted">{sub}</span>}
    </div>
  );
  const statusBadge = (r: ExpenseRow) => (
    <span className={`inline-block rounded-pill px-2 py-0.5 text-xs font-semibold ${r.status === "paid" ? "bg-accent-soft text-success" : r.status === "overdue" ? "bg-danger-soft text-danger" : "bg-warning-soft text-warning"}`}>
      {r.status === "paid" ? "Pago" : r.status === "overdue" ? "Vencida" : "Pendente"}
    </span>
  );
  const parcel = (r: ExpenseRow) => (r.installments && r.installments > 1 ? `${r.installment}/${r.installments}` : "—");
  async function openReceipt(r: ExpenseRow) {
    // Abre a aba antes de buscar o link, senão o navegador bloqueia o pop-up.
    const w = window.open("", "_blank");
    try {
      const url = await repo.receiptUrl(r.receiptPath!);
      if (url.startsWith("data:")) { w?.close(); const a = document.createElement("a"); a.href = url; a.download = "comprovante"; a.click(); }
      else if (w) w.location.href = url; else window.location.href = url;
    } catch (x) { w?.close(); toast(x instanceof Error ? x.message : "Não foi possível abrir o comprovante."); }
  }

  const actions = (r: ExpenseRow, compact = false) => (
    <div className="flex items-center justify-end">
      {r.status !== "paid" && (
        <button type="button" onClick={() => void pay(r)} aria-label={`Pagar ${r.t.description}`}
          title="Pagar" className="inline-flex items-center gap-1 rounded-sm px-2 py-1.5 text-sm font-semibold text-success hover:bg-accent-soft"><Check aria-hidden className="size-4" />{!compact && "Pagar"}</button>
      )}
      {r.receiptPath && (
        <button type="button" onClick={() => void openReceipt(r)} aria-label={`Ver comprovante de ${r.t.description}`} title="Comprovante"
          className="rounded-sm p-2 text-text-muted hover:bg-surface hover:text-text"><Paperclip className="size-4" /></button>
      )}
      <button type="button" onClick={() => void remove(r)} aria-label={`Excluir ${r.t.description}`} className="rounded-sm p-2 text-text-muted hover:bg-danger-soft hover:text-danger"><Trash2 className="size-4" /></button>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <nav ref={months} aria-label="Mês" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {MONTHS.map((m, i) => {
          const key = `${year}-${String(i + 1).padStart(2, "0")}`;
          return (
            <button key={key} type="button" aria-pressed={!adv.from && !adv.to && month === key} onClick={() => { setMonth(key); setAdv((a) => ({ ...a, from: "", to: "" })); }}
              className="h-9 shrink-0 rounded-md border border-border px-4 text-sm hover:bg-surface aria-pressed:border-accent aria-pressed:bg-accent-soft aria-pressed:font-semibold aria-pressed:text-accent">{m}</button>
          );
        })}
      </nav>

      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <header>
            <h1 className="flex items-center gap-2 text-xl font-bold"><ReceiptText aria-hidden className="size-5 text-accent" />Despesas / Compras</h1>
            <p className="text-sm text-text-muted">Gerencie todos os custos {whose}</p>
          </header>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen("filters")} aria-label={advActive ? "Filtros (ativos)" : "Filtros"}>
              <Filter aria-hidden className="size-4" />Filtros{advActive && <span aria-hidden className="size-2 rounded-pill bg-accent" />}
            </Button>
            <Button type="button" onClick={() => setOpen("new")}><Plus aria-hidden className="size-4" />Registrar Despesa</Button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-5">
          {stat("Despesas", formatBRL(s.despesaCents), null, "bg-danger-soft text-danger")}
          {stat("Compras", formatBRL(s.compraCents), null, "bg-surface text-blue-600")}
          {stat(<><UserRound aria-hidden className="size-3.5" />Folha</>, formatBRL(s.folhaCents), `${s.folhaCount} pagamento(s)`, "bg-surface text-text-muted")}
          {stat("Pendente", formatBRL(s.pendingCents), `${s.pendingCount} a pagar`, "bg-warning-soft text-warning")}
          <div className="col-span-2 lg:col-span-1">{stat("Vencidas", String(s.overdueCount), "parcelas em atraso", "bg-danger-soft text-danger")}</div>
        </div>
        {advActive && (
          <p className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
            Filtros ativos{(adv.from || adv.to) && `: ${adv.from ? dateBR(adv.from) : "início"} a ${adv.to ? dateBR(adv.to) : "hoje"}`}.
            <button type="button" onClick={() => setAdv(emptyAdvanced)} className="inline-flex items-center gap-0.5 font-semibold text-accent hover:underline"><X aria-hidden className="size-3" />Limpar</button>
          </p>
        )}
      </Card>

      <Card className="flex flex-col gap-3">
        <div role="tablist" aria-label="Tipo" className="flex flex-wrap gap-2">
          {[{ id: "all" as const, plural: "Todas" }, ...EXPENSE_TYPES].map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={type === t.id} onClick={() => setType(t.id)}
              className="inline-flex h-9 items-center gap-1.5 rounded-pill bg-surface px-4 text-sm font-medium hover:bg-accent-soft aria-selected:bg-accent aria-selected:text-on-accent">
              {t.id !== "all" && TYPE_ICON[t.id]}{t.plural}
            </button>
          ))}
        </div>
        <div aria-label="Situação" className="flex flex-wrap gap-2">
          {QUICK.map((q) => (
            <button key={q.id} type="button" aria-pressed={quick === q.id} onClick={() => setQuick(q.id)}
              className="h-8 rounded-pill border border-border px-3 text-xs hover:bg-surface aria-pressed:border-accent aria-pressed:bg-accent-soft aria-pressed:font-semibold aria-pressed:text-accent">{q.label}</button>
          ))}
        </div>
        {(quick === "overdue" || quick === "due7" || quick === "due30") && <p className="text-xs text-text-muted">Mostrando contas em aberto de todos os meses.</p>}
      </Card>

      {(error || fail) && <p role="alert" className="text-sm text-danger">{error || fail}</p>}

      <Card className="flex flex-col gap-3">
        <h2 className="font-semibold">Despesas por categoria</h2>
        {chart.length === 0 ? <p className="py-3 text-center text-sm text-text-muted">{all.length === 0 ? "Nenhuma despesa registrada ainda." : "Nenhuma despesa neste filtro."}</p> : (
          <ul className="flex flex-col gap-2.5">
            {chart.map((c) => (
              <li key={c.id || "none"} className="flex flex-col gap-1">
                <span className="flex justify-between gap-2 text-sm"><span className="truncate">{c.name}</span>
                  <span className="num shrink-0 font-semibold">{formatBRL(c.cents)} <span className="font-normal text-text-muted">· {Math.round((c.cents / Math.max(1, shownTotal)) * 100)}%</span></span></span>
                <span className="h-2 overflow-hidden rounded-pill bg-surface"><span className="block h-full rounded-pill bg-accent" style={{ width: `${(c.cents / chartMax) * 100}%` }} /></span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="!p-0">
        {shown.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-text-muted">{all.length === 0 ? "Nenhuma despesa registrada ainda." : "Nenhuma despesa neste filtro."}</p>
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-muted">
                    {["Tipo", "Data", "Fornecedor", "Categoria", "Funcionário", "Valor", "Vencimento", "Parcela", "Status", "Ações"].map((h) => (
                      <th key={h} scope="col" className={`whitespace-nowrap px-2.5 py-3 font-semibold ${h === "Valor" || h === "Ações" ? "text-right" : ""}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {shown.map((r) => (
                    <tr key={r.t.id}>
                      <td className="max-w-52 px-2.5 py-2.5">
                        <span className="block truncate font-medium">{r.t.description || expenseTypeLabel(r.type)}</span>
                        <span className="inline-flex items-center gap-1 text-xs text-text-muted">{TYPE_ICON[r.type]}{expenseTypeLabel(r.type)}</span>
                      </td>
                      <td className="num whitespace-nowrap px-2.5 py-2.5">{dateBR(r.t.occurredOn)}</td>
                      <td className="max-w-36 truncate px-2.5 py-2.5">{r.supplier || "—"}</td>
                      <td className="max-w-40 truncate px-2.5 py-2.5">{categoryName(r.t.categoryId ? cats.get(r.t.categoryId) : undefined, cats) || "—"}</td>
                      <td className="max-w-32 truncate px-2.5 py-2.5">{r.employee || "—"}</td>
                      <td className="num whitespace-nowrap px-2.5 py-2.5 text-right font-semibold">{formatBRL(r.t.amountCents)}</td>
                      <td className={`num whitespace-nowrap px-2.5 py-2.5 ${r.status === "overdue" ? "font-semibold text-danger" : ""}`}>{r.status === "paid" ? "—" : dateBR(r.due)}</td>
                      <td className="num px-2.5 py-2.5">{parcel(r)}</td>
                      <td className="px-2.5 py-2.5">{statusBadge(r)}</td>
                      <td className="px-2 py-1">{actions(r, true)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-border lg:hidden">
              {shown.map((r) => (
                <li key={r.t.id} className="flex flex-col gap-1.5 px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{r.t.description || expenseTypeLabel(r.type)}</p>
                      <p className="flex flex-wrap items-center gap-x-2 text-xs text-text-muted">
                        <span className="inline-flex items-center gap-1">{TYPE_ICON[r.type]}{expenseTypeLabel(r.type)}</span>
                        <span>{dateBR(r.t.occurredOn)}</span>
                        {r.supplier && <span>{r.supplier}</span>}
                        {r.employee && <span>{r.employee}</span>}
                        {r.t.categoryId && <span>{categoryName(cats.get(r.t.categoryId), cats)}</span>}
                      </p>
                    </div>
                    <span className="num shrink-0 font-bold">{formatBRL(r.t.amountCents)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-muted">{statusBadge(r)}
                      {r.status !== "paid" && <span className={r.status === "overdue" ? "font-semibold text-danger" : ""}>Vence {dateBR(r.due)}</span>}
                      {r.installments && r.installments > 1 && <span>{parcel(r)}</span>}</span>
                    {actions(r)}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
      <p className="-mt-2 text-xs text-text-muted">Despesas lançadas em Transações também aparecem aqui, como Despesa. Excluir manda o lançamento para a lixeira de Transações.</p>

      {open === "new" && (
        <ExpenseDialog details={details} onClose={() => setOpen(null)}
          onSaved={(saved, firstDay) => { setDetails([...details.filter((d) => !saved.some((x) => x.transactionId === d.transactionId)), ...saved]); setOpen(null); setMonth(firstDay.slice(0, 7)); setAdv(emptyAdvanced); setQuick("all"); setType("all"); }} />
      )}
      {open === "filters" && (
        <FiltersDialog initial={adv} month={month} categories={snap.categories} rows={all} onClose={() => setOpen(null)}
          onApply={(a) => { setAdv(a); setOpen(null); }} />
      )}
    </div>
  );
}

function expenseCategories(list: Category[]) {
  const map = new Map(list.map((c) => [c.id, c]));
  return list.filter((c) => !c.archived && (c.kind === "expense" || c.kind === "both"))
    .map((c) => ({ id: c.id, name: categoryName(c, map) })).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

function FiltersDialog({ initial, month, categories, rows, onClose, onApply }: {
  initial: Advanced; month: string; categories: Category[]; rows: ExpenseRow[]; onClose: () => void; onApply: (a: Advanced) => void;
}) {
  const [f, setF] = useState<Advanced>(() => ({ ...initial, from: initial.from || `${month}-01`, to: initial.to || `${month}-${String(daysInMonth(month)).padStart(2, "0")}` }));
  const set = (k: keyof Advanced) => (v: string) => setF((x) => ({ ...x, [k]: v }) as Advanced);
  const employees = distinct(rows.map((r) => r.employee));
  const suppliers = distinct(rows.map((r) => r.supplier));
  return (
    <Dialog onClose={onClose} title={<h2 className="text-lg font-bold">Filtros Avançados</h2>}>
      <form onSubmit={(e) => { e.preventDefault(); onApply(f); }} className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 font-semibold">Período</legend>
          <div className="grid grid-cols-2 gap-3">
            <Field label="De" htmlFor="fx-from"><Input id="fx-from" type="date" value={f.from} max={f.to || undefined} onChange={(e) => set("from")(e.target.value)} /></Field>
            <Field label="Até" htmlFor="fx-to"><Input id="fx-to" type="date" value={f.to} min={f.from || undefined} onChange={(e) => set("to")(e.target.value)} /></Field>
          </div>
        </fieldset>
        <Field label="Categoria" htmlFor="fx-cat">
          <select id="fx-cat" value={f.categoryId} onChange={(e) => set("categoryId")(e.target.value)} className={inputClass}>
            <option value="">Todas</option>
            {expenseCategories(categories).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Funcionário" htmlFor="fx-emp">
          <select id="fx-emp" value={f.employee} onChange={(e) => set("employee")(e.target.value)} className={inputClass}>
            <option value="">Todos</option>
            {employees.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </Field>
        <Field label="Fornecedor" htmlFor="fx-sup">
          <select id="fx-sup" value={f.supplier} onChange={(e) => set("supplier")(e.target.value)} className={inputClass}>
            <option value="">Todos</option>
            {suppliers.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </Field>
        <Field label="Status" htmlFor="fx-status">
          <select id="fx-status" value={f.status} onChange={(e) => set("status")(e.target.value)} className={inputClass}>
            <option value="all">Todos</option><option value="paid">Pago</option><option value="pending">Pendente</option>
          </select>
        </Field>
        <Button type="submit" size="lg" className="w-full rounded-pill">Aplicar Filtros</Button>
        <button type="button" onClick={() => onApply(emptyAdvanced)} className="-mt-2 text-sm font-semibold text-text-muted hover:text-text">Limpar filtros</button>
      </form>
    </Dialog>
  );
}

function ExpenseDialog({ details, onClose, onSaved }: { details: ExpenseDetail[]; onClose: () => void; onSaved: (saved: ExpenseDetail[], firstDay: string) => void }) {
  const { toast } = useShell();
  const snap = useSnapshot();
  const accounts = (snap?.accounts ?? []).filter((a) => !a.archived);
  const cards = (snap?.cards ?? []).filter((c) => !c.archived);
  const categories = snap?.categories ?? [];
  const bizNames = new Set(BUSINESS_CATEGORIES.map((c) => c.name.toLowerCase()));
  const ownCategories = expenseCategories(categories).filter((c) => !bizNames.has(c.name.toLowerCase()));
  const catMap = new Map(categories.map((c) => [c.id, c]));
  const suppliers = distinct(details.map((d) => d.supplier));
  const employees = distinct(details.map((d) => d.employee));
  const [f, setF] = useState({
    type: "despesa" as "despesa" | "compra", day: today(), cat: "", supplier: suppliers.length ? "" : NEW_SUPPLIER, newSupplier: "", employee: "",
    value: "", method: "pix" as PaymentMethod, accountId: accounts[0]?.id ?? "", cardId: cards[0]?.id ?? "",
    split: false, n: 2, firstDue: addMonthsToDay(today(), 1), paid: false, notes: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => { setF((x) => ({ ...x, [k]: v })); setErr({}); };
  const isCard = f.method === "credito";
  const cents = parseBRL(f.value);
  const catName = f.cat.startsWith("biz:") ? f.cat.slice(4) : f.cat ? categoryName(catMap.get(f.cat.slice(4)), catMap) : "";
  const payroll = f.cat === `biz:${PAYROLL_CATEGORY}` || (f.cat.startsWith("cat:") && catMap.get(f.cat.slice(4))?.name === PAYROLL_CATEGORY);
  const supplier = f.supplier === NEW_SUPPLIER ? f.newSupplier.trim() : f.supplier;
  const n = f.split ? f.n : 1;

  function pickFile(list: FileList | null) {
    const picked = list?.[0];
    if (fileInput.current) fileInput.current.value = "";
    if (!picked) return;
    const e = receiptError(picked);
    if (e) { setErr({ file: e }); return; }
    setFile(picked); setErr({});
  }

  /** Categoria escolhida: as sugeridas são criadas na primeira vez. */
  async function categoryId(): Promise<string | null> {
    if (f.cat.startsWith("cat:")) return f.cat.slice(4);
    const biz = BUSINESS_CATEGORIES.find((c) => `biz:${c.name}` === f.cat);
    if (!biz) return null;
    const found = findCategoryByName(categories, biz.name);
    if (found) return found.id;
    const created = await repo.upsertCategory({ name: biz.name, icon: biz.icon, kind: "expense", monthlyLimitCents: null, archived: false, color: null, parentId: null });
    return created.id;
  }

  async function save() {
    const e: Record<string, string> = {};
    if (!f.day) e.day = "Informe a data.";
    if (!f.cat) e.cat = "Escolha a categoria.";
    if (!f.value.trim() || cents == null || cents <= 0) e.value = "Informe o valor.";
    else if (cents < n) e.value = "Valor pequeno demais para dividir.";
    if (isCard && !f.cardId) e.method = "Cadastre um cartão de crédito primeiro.";
    if (!isCard && !f.accountId) e.method = "Cadastre uma conta primeiro.";
    if (f.split && !isCard && !f.firstDue) e.firstDue = "Informe o vencimento.";
    setErr(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const receiptPath = file ? await repo.uploadReceipt(file) : null;
      const common = { kind: "expense" as const, description: expenseDescription(catName, payroll ? f.employee : supplier), categoryId: await categoryId() };
      const extra = {
        type: (payroll ? "folha" : f.type) as ExpenseType, supplier: payroll ? "" : supplier, employee: payroll ? f.employee.trim() : "",
        paymentMethod: f.method, notes: f.notes.trim(), receiptPath,
      };
      let saved: ExpenseDetail[];
      let firstDay = f.day;
      if (isCard) {
        const rows = await repo.createTransaction({ ...common, amountCents: cents!, occurredOn: f.day, cardId: f.cardId, installments: n });
        saved = rows.map((t) => ({ transactionId: t.id, ...extra, groupId: null, installment: null, installments: null }));
      } else if (f.split) {
        // Boleto ou conta parcelada: uma despesa pendente por mês, a partir da 1ª parcela.
        const groupId = crypto.randomUUID();
        const parts = splitCents(cents!, n);
        saved = [];
        for (let i = 0; i < n; i++) {
          const due = addMonthsToDay(f.firstDue, i);
          const [t] = await repo.createTransaction({ ...common, amountCents: parts[i], occurredOn: due, dueOn: due, accountId: f.accountId, isPaid: false });
          saved.push({ transactionId: t.id, ...extra, groupId, installment: i + 1, installments: n });
        }
        firstDay = f.firstDue;
      } else {
        const rows = await repo.createTransaction({ ...common, amountCents: cents!, occurredOn: f.day, accountId: f.accountId, isPaid: f.paid, dueOn: f.paid ? undefined : f.day });
        saved = rows.map((t) => ({ transactionId: t.id, ...extra, groupId: null, installment: null, installments: null }));
      }
      await repo.saveExpenseDetails(saved);
      toast(saved.length > 1 ? `${saved.length} parcelas registradas` : `${expenseTypeLabel(extra.type)} registrada`);
      onSaved(saved, firstDay);
    } catch (x) { setErr({ form: x instanceof Error ? x.message : "Não foi possível registrar." }); }
    finally { setBusy(false); }
  }

  const sw = (id: string, on: boolean, toggle: () => void, label: string) => (
    <button id={id} type="button" role="switch" aria-checked={on} aria-label={label} onClick={toggle}
      className="relative h-7 w-12 shrink-0 rounded-pill bg-border transition-colors aria-checked:bg-accent">
      <span aria-hidden className={`absolute top-1 size-5 rounded-pill bg-white shadow-card transition-all ${on ? "left-6" : "left-1"}`} />
    </button>
  );

  return (
    <Dialog onClose={onClose} title={<h2 className="text-lg font-bold">Registrar Despesa</h2>}>
      <form onSubmit={(e) => { e.preventDefault(); void save(); }} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <span id="ex-type-label" className="text-xs font-semibold text-text-muted">Tipo</span>
          <div role="radiogroup" aria-labelledby="ex-type-label" className="grid grid-cols-2 gap-2">
            {(["despesa", "compra"] as const).map((t) => (
              <button key={t} type="button" role="radio" aria-checked={f.type === t} onClick={() => set("type", t)}
                className="flex h-11 items-center justify-center gap-2 rounded-md border border-border text-sm font-medium hover:bg-surface aria-checked:border-accent aria-checked:bg-accent-soft aria-checked:font-semibold aria-checked:text-accent">
                {t === "despesa" ? <Building2 aria-hidden className="size-4" /> : <Package aria-hidden className="size-4" />}{expenseTypeLabel(t)}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Data *" htmlFor="ex-day" error={err.day}>
            <Input id="ex-day" type="date" value={f.day} aria-invalid={!!err.day || undefined}
              onChange={(e) => { const d = e.target.value; setF((x) => ({ ...x, day: d, firstDue: d ? addMonthsToDay(d, 1) : x.firstDue })); setErr({}); }} />
          </Field>
          <Field label="Categoria *" htmlFor="ex-cat" error={err.cat}>
            <select id="ex-cat" value={f.cat} onChange={(e) => set("cat", e.target.value)} className={inputClass} aria-invalid={!!err.cat || undefined}>
              <option value="" disabled>Selecione a categoria</option>
              {BUSINESS_CATEGORIES.map((c) => <option key={c.name} value={`biz:${c.name}`}>{c.emoji} {c.name}</option>)}
              {ownCategories.length > 0 && (
                <optgroup label="Suas categorias">{ownCategories.map((c) => <option key={c.id} value={`cat:${c.id}`}>{c.name}</option>)}</optgroup>
              )}
            </select>
          </Field>
        </div>
        {payroll ? (
          <Field label="Funcionário" htmlFor="ex-emp" hint="Entra no card Folha">
            <Input id="ex-emp" list="ex-emps" maxLength={120} autoComplete="off" placeholder="Nome do funcionário" value={f.employee} onChange={(e) => set("employee", e.target.value)} />
            <datalist id="ex-emps">{employees.map((v) => <option key={v} value={v} />)}</datalist>
          </Field>
        ) : (
          <div className="flex flex-col gap-2">
            <Field label="Fornecedor" htmlFor="ex-sup">
              <select id="ex-sup" value={f.supplier} onChange={(e) => set("supplier", e.target.value)} className={inputClass}>
                {suppliers.length > 0 && <option value="">Sem fornecedor</option>}
                <option value={NEW_SUPPLIER}>＋ Novo fornecedor (digitar)</option>
                {suppliers.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </Field>
            {f.supplier === NEW_SUPPLIER && (
              <Input aria-label="Nome do novo fornecedor" maxLength={120} autoComplete="off" placeholder="Digite o nome do fornecedor"
                value={f.newSupplier} onChange={(e) => set("newSupplier", e.target.value)} />
            )}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label={f.split ? "Valor Total *" : "Valor *"} htmlFor="ex-value" error={err.value}>
            <div className="relative">
              <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-muted">R$</span>
              <Input id="ex-value" inputMode="decimal" placeholder="0,00" className="num pl-10" value={f.value}
                onChange={(e) => set("value", e.target.value.replace(/[^\d,.]/g, ""))} aria-invalid={!!err.value || undefined} />
            </div>
          </Field>
          <Field label="Forma de Pagamento" htmlFor="ex-method" error={err.method}>
            <select id="ex-method" value={f.method} onChange={(e) => set("method", e.target.value as PaymentMethod)} className={inputClass} aria-invalid={!!err.method || undefined}>
              {PAYMENT_METHODS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </Field>
        </div>
        {isCard ? (
          cards.length === 0 ? (
            <p className="rounded-md bg-surface px-3 py-2 text-sm">Nenhum cartão de crédito cadastrado. <Link href="/cartoes" className="font-semibold text-accent underline">Cadastrar cartão</Link></p>
          ) : cards.length > 1 && (
            <Field label="Cartão" htmlFor="ex-card">
              <select id="ex-card" value={f.cardId} onChange={(e) => set("cardId", e.target.value)} className={inputClass}>
                {cards.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
          )
        ) : accounts.length === 0 ? (
          <p className="rounded-md bg-surface px-3 py-2 text-sm">Nenhuma conta cadastrada. <Link href="/contas" className="font-semibold text-accent underline">Cadastrar conta</Link></p>
        ) : accounts.length > 1 && (
          <Field label={f.paid && !f.split ? "Pago com a conta" : "Conta"} htmlFor="ex-acc">
            <select id="ex-acc" value={f.accountId} onChange={(e) => set("accountId", e.target.value)} className={inputClass}>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
        )}

        <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="ex-split" className="flex items-center gap-2 text-sm font-semibold"><Layers aria-hidden className="size-4 text-accent" />Compra Parcelada</label>
            {sw("ex-split", f.split, () => set("split", !f.split), "Compra Parcelada")}
          </div>
          {f.split && (
            <div className={`grid gap-3 ${isCard ? "" : "sm:grid-cols-2"}`}>
              <Field label="Número de Parcelas" htmlFor="ex-n">
                <div className="flex items-center gap-2">
                  <button type="button" aria-label="Menos uma parcela" disabled={f.n <= 2} onClick={() => set("n", Math.max(2, f.n - 1))}
                    className="grid size-11 shrink-0 place-items-center rounded-md border border-border hover:bg-surface disabled:opacity-40"><Minus aria-hidden className="size-4" /></button>
                  <Input id="ex-n" type="number" inputMode="numeric" min={2} max={48} className="num text-center" value={f.n}
                    onChange={(e) => set("n", Math.min(48, Math.max(2, Math.round(Number(e.target.value) || 2))))} />
                  <button type="button" aria-label="Mais uma parcela" disabled={f.n >= 48} onClick={() => set("n", Math.min(48, f.n + 1))}
                    className="grid size-11 shrink-0 place-items-center rounded-md border border-border hover:bg-surface disabled:opacity-40"><Plus aria-hidden className="size-4" /></button>
                </div>
              </Field>
              {!isCard && (
                <Field label="1ª Parcela Vence em *" htmlFor="ex-first" error={err.firstDue}>
                  <Input id="ex-first" type="date" value={f.firstDue} onChange={(e) => set("firstDue", e.target.value)} aria-invalid={!!err.firstDue || undefined} />
                </Field>
              )}
              <p className="text-xs text-text-muted sm:col-span-2">
                {cents ? <>{f.n}x de <strong className="num text-text">{formatBRL(Math.floor(cents / f.n))}</strong>. </> : null}
                {isCard ? "Cada parcela vai para a fatura do mês." : "Cada parcela fica pendente até você tocar em Pagar."}
              </p>
            </div>
          )}
        </div>
        {!f.split && !isCard && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
            <label htmlFor="ex-paid" className="text-sm font-semibold">Já está pago?</label>
            {sw("ex-paid", f.paid, () => set("paid", !f.paid), "Já está pago?")}
          </div>
        )}

        <Field label="Histórico (opcional)" htmlFor="ex-notes">
          <textarea id="ex-notes" rows={3} maxLength={1000} placeholder="Ex: NF 12345, competência 01/2026, contrato nº 789..."
            value={f.notes} onChange={(e) => set("notes", e.target.value)} className={`${inputClass} h-auto resize-y py-2`} />
        </Field>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-text-muted">Comprovante (opcional)</span>
          <input ref={fileInput} id="ex-file" type="file" accept="application/pdf,image/jpeg,image/png" className="sr-only" onChange={(e) => pickFile(e.target.files)} />
          {file ? (
            <div className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5">
              <FileText aria-hidden className="size-5 shrink-0 text-accent" />
              <span className="min-w-0 flex-1 truncate text-sm">{file.name}</span>
              <span className="num shrink-0 text-xs text-text-muted">{file.size < 1024 * 1024 ? `${Math.max(1, Math.round(file.size / 1024))} KB` : `${(file.size / 1024 / 1024).toFixed(1).replace(".", ",")} MB`}</span>
              <button type="button" onClick={() => setFile(null)} aria-label="Remover comprovante" className="rounded-sm p-1 text-text-muted hover:bg-surface hover:text-text"><X className="size-4" /></button>
            </div>
          ) : (
            <label htmlFor="ex-file"
              onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); pickFile(e.dataTransfer.files); }}
              className="flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 border-dashed border-border px-3 py-5 text-center hover:bg-surface">
              <CloudUpload aria-hidden className="size-6 text-text-muted" />
              <span className="text-sm font-medium">Clique para fazer upload</span>
              <span className="text-xs text-text-muted">PDF, JPG ou PNG até 5MB</span>
            </label>
          )}
          {err.file && <p className="text-xs text-danger">{err.file}</p>}
        </div>
        {err.form && <p role="alert" className="text-sm text-danger">{err.form}</p>}
        <Button type="submit" size="lg" loading={busy} className="w-full rounded-pill">{f.split ? `Criar ${f.n} Parcelas` : "Registrar Despesa"}</Button>
      </form>
    </Dialog>
  );
}
