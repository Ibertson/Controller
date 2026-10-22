"use client";

import { useRef, useState } from "react";
import { BarChart3, ChevronDown, ChevronUp, CircleCheck, Info, LayoutGrid, List, Pencil, PieChart, Plus, Search, Target, Trash2 } from "lucide-react";
import { useShell } from "@/components/AppShell";
import { Dialog } from "@/components/Dialog";
import { InvestmentGoalModal, InvestmentModal, TYPE_COLOR, TYPE_ICON } from "@/components/InvestmentModals";
import { LineChart } from "@/components/charts";
import { Button, Card, Skeleton, inputClass } from "@/components/ui";
import { repo, useSnapshot } from "@/lib/data";
import { monthOf, today } from "@/lib/dates";
import {
  appreciation, distributionByType, evolutionMonths, goalProgress, investedByMonth, investmentTotals, investmentTypeLabel,
  investmentsOf, matchesSearch, returnPct, TYPE_TABS, INVESTMENT_TYPES, type EvolutionPeriod,
} from "@/lib/investments";
import { formatBRL } from "@/lib/money";
import type { Slice } from "@/lib/summary";
import type { Investment, InvestmentGoal, InvestmentType } from "@/lib/types";

const fmtDate = (d: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(d + "T00:00:00Z"));
const signed = (c: number) => `${c >= 0 ? "+" : "−"}${formatBRL(Math.abs(c))}`;
const pct = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
const tone = (c: number) => (c > 0 ? "text-income" : c < 0 ? "text-expense" : "text-text-muted");

const PERIODS: [EvolutionPeriod, string][] = [["6m", "6 meses"], ["12m", "12 meses"], ["year", "Ano"], ["all", "Tudo"]];

/** Rosca compacta para a coluna estreita, nas cores de cada tipo. */
function TypeDonut({ slices }: { slices: Slice[] }) {
  const total = slices.reduce((a, s) => a + s.cents, 0);
  const r = 60, c = 2 * Math.PI * r;
  const lens = slices.map((s) => (s.cents / total) * c);
  const starts = lens.map((_, i) => lens.slice(0, i).reduce((a, v) => a + v, 0));
  return (
    <svg viewBox="0 0 160 160" role="img" aria-label={`Distribuição: ${slices.map((s) => `${s.label} ${Math.round((s.cents / total) * 100)}%`).join(", ")}`}
      className="mx-auto size-40 -rotate-90">
      <circle cx={80} cy={80} r={r} fill="none" strokeWidth={22} style={{ stroke: "var(--color-surface)" }} />
      {slices.map((s, i) => (
        <circle key={s.id} cx={80} cy={80} r={r} fill="none" strokeWidth={22} strokeDasharray={`${lens[i]} ${c - lens[i]}`} strokeDashoffset={-starts[i]}
          style={{ stroke: TYPE_COLOR[s.id as InvestmentType] }} />
      ))}
    </svg>
  );
}

function TypeBadge({ type }: { type: InvestmentType }) {
  const Icon = TYPE_ICON[type];
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm">
      <Icon aria-hidden className="size-4 shrink-0" style={{ color: TYPE_COLOR[type] }} />{investmentTypeLabel(type)}
    </span>
  );
}

const ABOUT: [InvestmentType, string][] = [
  ["tesouro", "Títulos públicos do governo federal, comprados por corretoras. Selic acompanha a taxa básica de juros; Prefixado e IPCA+ travam a rentabilidade."],
  ["cdb", "Empréstimos a bancos (CDB) ou financeiras (RDB). Costumam render um percentual do CDI e têm garantia do FGC até o limite."],
  ["acoes", "Pedaços de empresas negociados na bolsa. O valor oscila todo dia e podem pagar dividendos, que entram em Proventos Recebidos."],
  ["fundos", "Carteiras administradas por um gestor: renda fixa, multimercado, ações ou imobiliários (FIIs), que distribuem rendimentos."],
  ["outros", "Previdência, poupança, criptomoedas, LCI/LCA, debêntures e qualquer outra aplicação que você queira acompanhar."],
];

export default function Investimentos() {
  const snap = useSnapshot();
  const { toast } = useShell();
  const [period, setPeriod] = useState<EvolutionPeriod>("12m");
  const [quick, setQuick] = useState("");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<InvestmentType | "all">("all");
  const [donut, setDonut] = useState(true);
  const [goalsOpen, setGoalsOpen] = useState(true);
  const [about, setAbout] = useState(false);
  const [form, setForm] = useState<null | { item?: Investment }>(null);
  const [goalForm, setGoalForm] = useState<null | { goal?: InvestmentGoal }>(null);
  const tableRef = useRef<HTMLElement>(null);

  if (!snap) return <Skeleton className="h-64" />;
  const list = investmentsOf(snap);
  const goals = snap.investmentGoals ?? [];
  const totals = investmentTotals(list);
  const slices = distributionByType(list);
  const months = evolutionMonths(list, period, monthOf(today()));
  const rows = list.filter((i) => (tab === "all" || i.type === tab) && matchesSearch(i, search))
    .sort((a, b) => b.boughtOn.localeCompare(a.boughtOn) || a.name.localeCompare(b.name, "pt-BR"));
  const quickHits = quick.trim() ? list.filter((i) => matchesSearch(i, quick)).slice(0, 5) : [];

  async function removeInvestment(i: Investment) {
    if (!confirm(`Excluir o investimento "${i.name}"?`)) return;
    await repo.deleteInvestment(i.id);
    toast("Investimento excluído", { label: "Desfazer", run: () => void repo.upsertInvestment(i) });
  }
  async function removeGoal(g: InvestmentGoal) {
    if (!confirm(`Excluir a meta "${g.name}"?`)) return;
    await repo.deleteInvestmentGoal(g.id);
    toast("Meta excluída", { label: "Desfazer", run: () => void repo.upsertInvestmentGoal(g) });
  }
  function showInTable() {
    setSearch(quick);
    setTab("all");
    tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-accent px-6 py-5 text-white shadow-card">
        <div>
          <h1 className="text-2xl font-bold">Total em investimentos: <span className="num">{formatBRL(totals.patrimonyCents)}</span></h1>
          <p className="mt-1 text-sm text-white/85">Valor recebido: <span className="num">{formatBRL(totals.incomeCents)}</span> · Aplicado: <span className="num">{formatBRL(totals.investedCents)}</span></p>
        </div>
        <button type="button" onClick={() => setForm({})}
          className="inline-flex h-10 items-center gap-2 rounded-md bg-white px-4 text-sm font-semibold text-accent shadow-card hover:bg-white/90">
          <Plus aria-hidden className="size-4" />Novo Investimento
        </button>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card className="flex flex-col gap-4">
          <div role="tablist" aria-label="Período" className="flex flex-wrap gap-1">
            {PERIODS.map(([v, l]) => (
              <button key={v} type="button" role="tab" aria-selected={period === v} onClick={() => setPeriod(v)}
                className="h-9 rounded-md px-3 text-sm font-medium text-text-muted hover:bg-surface aria-selected:bg-accent aria-selected:text-white">{l}</button>
            ))}
          </div>
          {list.length ? (
            <LineChart months={months} label="Evolução do total investido por mês"
              series={[{ label: "Total investido", color: "var(--color-accent)", values: investedByMonth(list, months) }]} />
          ) : (
            <p className="grid min-h-56 place-items-center text-center text-sm text-text-muted">Adicione investimentos para visualizar a evolução</p>
          )}
          <div className="grid grid-cols-2 gap-3 border-t border-border pt-4 sm:grid-cols-3">
            {([["Patrimônio", formatBRL(totals.patrimonyCents), ""], ["Valoriz.", signed(totals.appreciationCents), tone(totals.appreciationCents)],
              ["Rendimento", signed(totals.returnCents), tone(totals.returnCents)]] as const).map(([l, v, t]) => (
              <div key={l}>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">{l}</p>
                <p className={`num whitespace-nowrap text-base font-bold sm:text-lg ${t}`}>{v}</p>
              </div>
            ))}
          </div>
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="flex flex-col gap-2">
            <div className="relative flex items-center">
              <Search aria-hidden className="pointer-events-none absolute left-3 size-4 text-text-muted" />
              <input type="search" aria-label="Buscar investimento" placeholder="Buscar investimento..." value={quick}
                onChange={(e) => setQuick(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") showInTable(); }}
                className={`${inputClass} pl-9 pr-11`} />
              <button type="button" onClick={showInTable} aria-label="Ver na tabela" title="Ver na tabela"
                className="absolute right-1 grid size-9 place-items-center rounded-md text-text-muted hover:bg-surface hover:text-text"><List aria-hidden className="size-4" /></button>
            </div>
            {quick.trim() && (
              <ul className="flex flex-col">
                {quickHits.length ? quickHits.map((i) => (
                  <li key={i.id}>
                    <button type="button" onClick={() => setForm({ item: i })} className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-surface">
                      <span className="truncate">{i.name}</span><span className="num shrink-0 text-text-muted">{formatBRL(i.currentCents ?? i.investedCents)}</span>
                    </button>
                  </li>
                )) : <li className="px-2 py-2 text-sm text-text-muted">Nada encontrado</li>}
              </ul>
            )}
            <button type="button" onClick={() => setAbout(true)}
              className="flex h-10 items-center gap-2 rounded-md px-3 text-sm text-text-muted hover:bg-surface hover:text-text">
              <Info aria-hidden className="size-4" /><span className="flex-1 text-left">Mais sobre investimentos...</span><LayoutGrid aria-hidden className="size-4" />
            </button>
          </Card>

          <Card className="flex flex-1 flex-col gap-4">
            <h2 className="font-semibold">Distribuição dos Investimentos</h2>
            {slices.length ? (
              <>
                {donut ? <TypeDonut slices={slices} /> : null}
                <ul className="flex flex-col gap-2.5">
                  {slices.map((s) => {
                    const ratio = s.cents / totals.patrimonyCents;
                    return (
                      <li key={s.id}>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="size-2.5 shrink-0 rounded-pill" style={{ background: TYPE_COLOR[s.id as InvestmentType] }} />
                          <span className="flex-1 truncate">{s.label}</span>
                          <span className="num text-text-muted">{Math.round(ratio * 100)}%</span>
                          <span className="num font-semibold">{formatBRL(s.cents)}</span>
                        </div>
                        {!donut && (
                          <div className="mt-1.5 h-2 overflow-hidden rounded-pill bg-surface">
                            <span className="block h-full rounded-pill" style={{ width: `${ratio * 100}%`, background: TYPE_COLOR[s.id as InvestmentType] }} />
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : (
              <p className="grid flex-1 min-h-32 place-items-center text-center text-sm text-text-muted">Nenhum investimento cadastrado</p>
            )}
            <button type="button" onClick={() => setDonut((d) => !d)} aria-pressed={!donut}
              className="mt-auto flex h-10 items-center gap-2 border-t border-border pt-3 text-sm text-text-muted hover:text-text">
              {donut ? <BarChart3 aria-hidden className="size-4" /> : <PieChart aria-hidden className="size-4" />}Alternar Modo de Visualização
            </button>
          </Card>
        </div>
      </div>

      <Card className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-semibold"><Target aria-hidden className="size-5 text-accent" />Metas de Investimento</h2>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="secondary" className="whitespace-nowrap" onClick={() => setGoalForm({})}><Plus aria-hidden className="size-4" />Nova Meta</Button>
            <button type="button" aria-expanded={goalsOpen} aria-label={goalsOpen ? "Recolher metas" : "Mostrar metas"} onClick={() => setGoalsOpen((o) => !o)}
              className="grid size-9 place-items-center rounded-md text-text-muted hover:bg-surface hover:text-text">
              {goalsOpen ? <ChevronUp aria-hidden className="size-4" /> : <ChevronDown aria-hidden className="size-4" />}
            </button>
          </div>
        </div>
        {goalsOpen && (goals.length ? (
          <ul className="grid gap-3 md:grid-cols-2">
            {goals.map((g) => {
              const have = goalProgress(g, list);
              const ratio = Math.min(1, have / g.targetCents);
              const done = have >= g.targetCents;
              const late = !done && !!g.deadline && g.deadline < today();
              return (
                <li key={g.id} className="flex flex-col gap-2 rounded-md border border-border p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{g.name}</p>
                      <p className="text-xs text-text-muted">{g.assetType ? investmentTypeLabel(g.assetType) : "Todos os tipos"}{g.deadline && <span className={late ? "text-expense" : ""}> · {late ? "venceu em" : "até"} {fmtDate(g.deadline)}</span>}</p>
                    </div>
                    <span className="flex shrink-0 gap-1">
                      <button type="button" aria-label={`Editar ${g.name}`} title="Editar" onClick={() => setGoalForm({ goal: g })}
                        className="grid size-8 place-items-center rounded-md text-text-muted hover:bg-surface hover:text-text"><Pencil aria-hidden className="size-4" /></button>
                      <button type="button" aria-label={`Excluir ${g.name}`} title="Excluir" onClick={() => void removeGoal(g)}
                        className="grid size-8 place-items-center rounded-md text-text-muted hover:bg-surface hover:text-danger"><Trash2 aria-hidden className="size-4" /></button>
                    </span>
                  </div>
                  {g.description && <p className="line-clamp-2 text-sm text-text-muted">{g.description}</p>}
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="num font-semibold">{formatBRL(have)}</span><span className="num text-text-muted">de {formatBRL(g.targetCents)}</span>
                  </div>
                  <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(ratio * 100)} aria-label={`Progresso de ${g.name}`}
                    className="h-2 overflow-hidden rounded-pill bg-surface">
                    <span className={`block h-full rounded-pill ${done ? "bg-income" : "bg-accent"}`} style={{ width: `${ratio * 100}%` }} />
                  </div>
                  <p className="flex items-center gap-1 text-xs text-text-muted">
                    {done ? <><CircleCheck aria-hidden className="size-3.5 text-income" />Meta atingida</> : `${Math.round(ratio * 100)}% · faltam ${formatBRL(g.targetCents - have)}`}
                  </p>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="flex flex-col items-center gap-1 py-8 text-center">
            <Target aria-hidden className="size-12 text-text-muted" strokeWidth={1.5} />
            <p className="mt-2 font-medium">Nenhuma meta definida</p>
            <p className="text-sm text-text-muted">Clique em &quot;Nova Meta&quot; para começar</p>
          </div>
        ))}
      </Card>

      <Card className="flex flex-col gap-4">
        <section ref={tableRef} aria-labelledby="inv-table-title" className="flex scroll-mt-4 flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="inv-table-title" className="font-semibold">Meus Investimentos</h2>
            <div className="relative w-full sm:w-64">
              <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
              <input type="search" aria-label="Buscar na tabela" placeholder="Buscar investimento..." value={search} onChange={(e) => setSearch(e.target.value)}
                className={`${inputClass} h-10 pl-9`} />
            </div>
          </div>
          <div role="tablist" aria-label="Tipo" className="flex gap-1 overflow-x-auto border-b border-border">
            {([["all", "Todos"], ...TYPE_TABS] as [InvestmentType | "all", string][]).map(([v, l]) => (
              <button key={v} type="button" role="tab" aria-selected={tab === v} onClick={() => setTab(v)}
                className="-mb-px h-10 shrink-0 border-b-2 border-transparent px-3 text-sm text-text-muted hover:text-text aria-selected:border-accent aria-selected:font-semibold aria-selected:text-accent">{l}</button>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-text-muted">
                  <th className="py-2 pr-3 font-semibold">Tipo</th><th className="py-2 pr-3 font-semibold">Nome</th>
                  <th className="py-2 pr-3 text-right font-semibold">Aplicado</th><th className="py-2 pr-3 text-right font-semibold">Rent.</th>
                  <th className="py-2 pr-3 text-right font-semibold">Valoriz.</th><th className="py-2 pr-3 text-right font-semibold">Recebido</th>
                  <th className="py-2 pr-3 font-semibold">Vencimento</th><th className="py-2 text-right font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.length ? rows.map((i) => {
                  const ap = appreciation(i), rp = returnPct(i);
                  const matured = !!i.maturityOn && i.maturityOn < today();
                  return (
                    <tr key={i.id} className="border-b border-border last:border-0">
                      <td className="py-3 pr-3"><TypeBadge type={i.type} /></td>
                      <td className="max-w-64 py-3 pr-3">
                        <p className="truncate font-medium">{i.name}</p>
                        <p className="truncate text-xs text-text-muted">{[i.institution, i.rate != null && `${i.rate.toLocaleString("pt-BR")}% a.a.`, `desde ${fmtDate(i.boughtOn)}`].filter(Boolean).join(" · ")}</p>
                      </td>
                      <td className="num py-3 pr-3 text-right">{formatBRL(i.investedCents)}</td>
                      <td className={`num py-3 pr-3 text-right ${tone(rp)}`}>{pct(rp)}</td>
                      <td className={`num py-3 pr-3 text-right ${tone(ap)}`}>{signed(ap)}</td>
                      <td className="num py-3 pr-3 text-right">{formatBRL(i.incomeCents)}</td>
                      <td className={`py-3 pr-3 ${matured ? "text-expense" : ""}`}>{i.maturityOn ? fmtDate(i.maturityOn) : "—"}</td>
                      <td className="py-3 text-right">
                        <span className="inline-flex gap-1">
                          <button type="button" aria-label={`Editar ${i.name}`} title="Editar" onClick={() => setForm({ item: i })}
                            className="grid size-8 place-items-center rounded-md text-text-muted hover:bg-surface hover:text-text"><Pencil aria-hidden className="size-4" /></button>
                          <button type="button" aria-label={`Excluir ${i.name}`} title="Excluir" onClick={() => void removeInvestment(i)}
                            className="grid size-8 place-items-center rounded-md text-text-muted hover:bg-surface hover:text-danger"><Trash2 aria-hidden className="size-4" /></button>
                        </span>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr><td colSpan={8} className="py-8 text-center text-text-muted">Nenhum investimento encontrado</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-text-muted">
            Exibindo {rows.length} de {list.length} investimentos · Total aplicado: <span className="num font-semibold text-accent">{formatBRL(rows.reduce((a, i) => a + i.investedCents, 0))}</span>
          </p>
        </section>
      </Card>

      {form && <InvestmentModal item={form.item} onClose={() => setForm(null)} onSaved={(m) => toast(m)} />}
      {goalForm && <InvestmentGoalModal goal={goalForm.goal} onClose={() => setGoalForm(null)} onSaved={(m) => toast(m)} />}
      {about && (
        <Dialog onClose={() => setAbout(false)} title={<h2 className="text-lg font-semibold">Mais sobre investimentos</h2>}>
          <ul className="flex flex-col gap-4">
            {ABOUT.map(([t, text]) => (
              <li key={t} className="flex gap-3">
                {(() => { const I = TYPE_ICON[t]; return <I aria-hidden className="mt-0.5 size-5 shrink-0" style={{ color: TYPE_COLOR[t] }} />; })()}
                <div><p className="font-semibold">{INVESTMENT_TYPES.find(([k]) => k === t)?.[1]}</p><p className="text-sm text-text-muted">{text}</p></div>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-text-muted">Rent. = (valorização + proventos) ÷ aplicado. Valoriz. = valor atual − aplicado. Sem valor atual, o investimento vale o aplicado.</p>
        </Dialog>
      )}
    </div>
  );
}
