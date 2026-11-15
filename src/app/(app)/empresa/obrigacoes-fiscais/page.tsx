"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Bell, Building2, CalendarClock, CheckCircle2, Lightbulb, Receipt, TrendingUp } from "lucide-react";
import { useShell } from "@/components/AppShell";
import { useSpace } from "@/components/business";
import { Button, Card, Skeleton, inputClass } from "@/components/ui";
import { repo, useSnapshot } from "@/lib/data";
import { today } from "@/lib/dates";
import { ANEXOS, anexoLabel, asAnexo, guideExpense, guideRef, isSimples, simplesGuide, yearProgress, type Anexo } from "@/lib/fiscal";
import { formatBRL } from "@/lib/money";
import { revenueLimit } from "@/lib/reports";
import type { Snapshot } from "@/lib/types";

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const pct = (n: number) => `${n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const br = (day: string) => day.split("-").reverse().join("/");
const monthText = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1].toLowerCase()} de ${m.slice(0, 4)}`;
/** Cor da barra conforme o uso do limite. */
const tone = (p: number) => (p >= 100 ? "bg-danger" : p >= 80 ? "bg-warning" : "bg-accent");

/** Obrigações Fiscais: guia mensal do Simples (ou DAS do MEI) e o limite de faturamento do ano. */
export default function ObrigacoesFiscais() {
  const { kind, company } = useSpace();
  const snap = useSnapshot();
  const { toast } = useShell();
  const now = today();
  const [month, setMonth] = useState(`${now.slice(0, 7)}-01`);
  const saved = asAnexo(company?.details?.simplesAnexo);
  const [choice, setChoice] = useState<string>("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const months = useRef<HTMLElement>(null);
  useEffect(() => { months.current?.querySelector<HTMLElement>("[aria-pressed=true]")?.scrollIntoView({ block: "nearest", inline: "center" }); }, [kind]);

  if (kind !== "business" || !company) {
    return (
      <Card className="flex flex-col items-center gap-3 py-10 text-center">
        <Building2 aria-hidden className="size-9 text-text-muted" />
        <h1 className="font-semibold">Obrigações Fiscais faz parte do Painel Empresarial</h1>
        <p className="max-w-md text-sm text-text-muted">Abra a aba Empresarial no topo da tela para acompanhar a guia mensal e o limite de faturamento.</p>
      </Card>
    );
  }
  if (!snap) return <div className="flex flex-col gap-4"><Skeleton className="h-20" /><Skeleton className="h-40" /><Skeleton className="h-56" /></div>;

  const type = company.companyType;
  const mei = type === "mei";
  const simples = isSimples(type);
  const limit = revenueLimit(type);
  const year = Number(now.slice(0, 4));

  async function saveAnexo() {
    const a = asAnexo(Number(choice));
    if (!a) { toast("Selecione o Anexo."); return; }
    setBusy(true);
    try {
      await repo.updateCompany({ ...company!, details: { ...company!.details, simplesAnexo: a } });
      setEditing(false); toast("Anexo salvo");
    } catch (e) { toast(e instanceof Error ? e.message : "Não foi possível salvar."); }
    finally { setBusy(false); }
  }

  return (
    <div className="flex flex-col gap-4">
      <nav ref={months} aria-label="Mês" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {MONTHS.map((m, i) => {
          const key = `${year}-${String(i + 1).padStart(2, "0")}-01`;
          return (
            <button key={key} type="button" aria-pressed={month === key} onClick={() => setMonth(key)}
              className="h-9 shrink-0 rounded-md border border-border px-4 text-sm hover:bg-surface aria-pressed:border-accent aria-pressed:bg-accent-soft aria-pressed:font-semibold aria-pressed:text-accent">{m}</button>
          );
        })}
      </nav>

      <Card>
        <h1 className="text-2xl font-bold">Obrigações Fiscais</h1>
        <p className="text-sm text-text-muted">{mei ? "Acompanhe o DAS mensal do MEI e o seu limite de faturamento" : "Acompanhe a guia mensal do Simples Nacional e sua meta de faturamento"}</p>
      </Card>

      {simples && (!saved || editing) && (
        <Card className="flex flex-col gap-3">
          <h2 className="font-semibold">Configure o Anexo do Simples Nacional</h2>
          <p className="text-sm text-text-muted">Pra calcular sua guia mensal precisamos saber em qual Anexo (I a V) sua empresa está enquadrada. Se não souber, seu contador tem essa informação.</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label htmlFor="of-anexo" className="sr-only">Anexo do Simples Nacional</label>
            <select id="of-anexo" value={choice || (saved ? String(saved) : "")} onChange={(e) => setChoice(e.target.value)} className={`${inputClass} sm:max-w-md`}>
              <option value="" disabled>Selecione o Anexo</option>
              {ANEXOS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
            <div className="flex gap-2">
              <Button onClick={saveAnexo} loading={busy} disabled={busy || !(choice || saved)}>Salvar</Button>
              {editing && <Button variant="secondary" onClick={() => { setEditing(false); setChoice(""); }}>Cancelar</Button>}
            </div>
          </div>
        </Card>
      )}

      {simples && saved && !editing && <SimplesGuideCard snap={snap} month={month} anexo={saved} now={now} onChangeAnexo={() => { setChoice(String(saved)); setEditing(true); }} />}
      {mei && <MeiGuideCard snap={snap} month={month} dasCents={company.details?.dasCents ?? null} now={now} />}
      {!simples && !mei && (
        <Card className="flex items-start gap-3 text-sm">
          <Lightbulb aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
          <p className="text-text-muted">A sua empresa não está cadastrada como MEI nem no Simples Nacional, então as guias variam conforme o regime e são calculadas pelo contador. Você pode mudar o tipo da empresa em <Link href="/empresa/configuracoes" className="font-semibold text-accent hover:underline">Configurações</Link>.</p>
        </Card>
      )}

      {limit != null && <LimitCards snap={snap} year={year} now={now} limit={limit} mei={mei} />}

      <Card className="flex gap-3 bg-accent-soft/40">
        <span className="grid size-9 shrink-0 place-items-center rounded-md bg-accent text-on-accent"><Bell aria-hidden className="size-4" /></span>
        <div className="flex flex-col gap-1.5">
          <h2 className="font-semibold">Alertas Automáticos</h2>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm marker:text-accent">
            <li>Aviso nesta tela quando o faturamento passar de 80% do limite anual.</li>
            <li>Aviso nesta tela quando a guia do mês estiver perto de vencer ou vencida.</li>
            <li>Notificação no celular e por e-mail (em breve).</li>
          </ul>
        </div>
      </Card>
    </div>
  );
}

/** Situação da guia: lançada nas despesas, paga ou vencida, e o botão para lançar. */
function GuideStatus({ snap, month, valueCents, dueOn, now, label, partial }: { snap: Snapshot; month: string; valueCents: number; dueOn: string; now: string; label: string; partial: boolean }) {
  const { toast } = useShell();
  const [busy, setBusy] = useState(false);
  const tx = guideExpense(snap, month);
  const days = Math.round((Date.parse(dueOn) - Date.parse(now)) / 86_400_000);
  const future = month > `${now.slice(0, 7)}-01`;

  async function launch() {
    const account = snap.accounts.find((a) => !a.archived);
    if (!account) { toast("Cadastre uma conta antes de lançar a guia."); return; }
    setBusy(true);
    try {
      let cat = snap.categories.find((c) => !c.archived && c.kind !== "income" && c.name.trim().toLowerCase() === "impostos");
      if (!cat) cat = await repo.upsertCategory({ name: "Impostos", icon: "percent", kind: "expense", monthlyLimitCents: null, archived: false, color: null, parentId: null });
      await repo.createTransaction({ kind: "expense", amountCents: valueCents, occurredOn: dueOn, dueOn, description: `${label} ${guideRef(month)}`, accountId: account.id, categoryId: cat.id, isPaid: false });
      toast("Guia lançada nas despesas");
    } catch (e) { toast(e instanceof Error ? e.message : "Não foi possível lançar a guia."); }
    finally { setBusy(false); }
  }

  if (tx) {
    return tx.isPaid
      ? <p className="flex items-center gap-2 text-sm font-semibold text-income"><CheckCircle2 aria-hidden className="size-4" />Guia paga ({formatBRL(tx.amountCents)})</p>
      : <p className="flex items-center gap-2 text-sm"><CalendarClock aria-hidden className="size-4 text-accent" />Lançada nas despesas: {formatBRL(tx.amountCents)} vence em {br(tx.dueOn ?? tx.occurredOn)}. <Link href="/empresa/despesas" className="font-semibold text-accent hover:underline">Pagar</Link></p>;
  }
  return (
    <div className="flex flex-col gap-2">
      {!future && days < 0 && <p role="alert" className="flex items-center gap-2 text-sm font-semibold text-danger"><AlertTriangle aria-hidden className="size-4" />Guia vencida há {-days} {-days === 1 ? "dia" : "dias"}. Pague com juros e multa no portal do Simples.</p>}
      {!future && days >= 0 && days <= 5 && <p role="alert" className="flex items-center gap-2 text-sm font-semibold text-warning"><AlertTriangle aria-hidden className="size-4" />Vence {days === 0 ? "hoje" : `em ${days} ${days === 1 ? "dia" : "dias"}`}.</p>}
      {!future && valueCents > 0 && (
        <Button variant="secondary" onClick={launch} loading={busy} disabled={busy || partial} className="self-start">
          <Receipt aria-hidden className="size-4" />Lançar nas despesas
        </Button>
      )}
      {partial && valueCents > 0 && <p className="text-xs text-text-muted">O mês ainda não terminou: o valor muda até o último dia. Você poderá lançar a guia a partir do dia 1º.</p>}
    </div>
  );
}

function SimplesGuideCard({ snap, month, anexo, now, onChangeAnexo }: { snap: Snapshot; month: string; anexo: Anexo; now: string; onChangeAnexo: () => void }) {
  const g = simplesGuide(snap, month, anexo);
  const partial = month === `${now.slice(0, 7)}-01`;
  const future = month > `${now.slice(0, 7)}-01`;
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">Guia do Simples Nacional · {monthText(month)}</h2>
          <p className="text-sm text-text-muted">{anexoLabel(anexo)} · <button type="button" onClick={onChangeAnexo} className="font-semibold text-accent hover:underline">Trocar</button></p>
        </div>
        <span className="rounded-pill bg-accent-soft px-3 py-1 text-xs font-semibold text-accent">Vence {br(g.dueOn)}</span>
      </div>
      {future ? <p className="text-sm text-text-muted">Esse mês ainda não começou.</p> : !g.rate ? (
        <p role="alert" className="text-sm text-danger">A receita dos últimos 12 meses passou de R$ 4,8 milhões, o teto do Simples Nacional. Fale com o seu contador.</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label={partial ? "Valor estimado até agora" : "Valor estimado da guia"} value={formatBRL(g.valueCents)} strong />
            <Stat label="Faturamento do mês" value={formatBRL(g.revenueCents)} />
            <Stat label="Alíquota efetiva" value={`${g.rate.effective.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`} />
          </div>
          <p className="text-xs text-text-muted">
            Faixa {g.rate.faixa}: alíquota nominal {g.rate.nominal.toLocaleString("pt-BR")}%{g.rate.deductionCents > 0 && <> menos {formatBRL(g.rate.deductionCents)} de parcela a deduzir</>}, sobre a receita dos últimos 12 meses de <span className="num">{formatBRL(g.rbt12Cents)}</span>
            {g.proportional && " (empresa com menos de 12 meses: média mensal × 12)"}. É uma estimativa; o valor oficial sai no PGDAS-D.
          </p>
          <GuideStatus snap={snap} month={month} valueCents={g.valueCents} dueOn={g.dueOn} now={now} label="DAS Simples Nacional" partial={partial} />
        </>
      )}
    </Card>
  );
}

function MeiGuideCard({ snap, month, dasCents, now }: { snap: Snapshot; month: string; dasCents: number | null; now: string }) {
  const g = simplesGuide(snap, month, 1);
  const future = month > `${now.slice(0, 7)}-01`;
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="font-semibold">DAS MEI · {monthText(month)}</h2>
        <span className="rounded-pill bg-accent-soft px-3 py-1 text-xs font-semibold text-accent">Vence {br(g.dueOn)}</span>
      </div>
      {!dasCents ? (
        <p className="text-sm text-text-muted">Informe o valor do seu DAS mensal em <Link href="/empresa/configuracoes" className="font-semibold text-accent hover:underline">Configurações</Link> para acompanhar a guia.</p>
      ) : (
        <>
          <p className="num text-3xl font-bold text-accent">{formatBRL(dasCents)}</p>
          <p className="text-xs text-text-muted">O DAS do MEI tem valor fixo por mês, mesmo sem faturamento.</p>
          {!future && <GuideStatus snap={snap} month={month} valueCents={dasCents} dueOn={g.dueOn} now={now} label="DAS MEI" partial={false} />}
        </>
      )}
    </Card>
  );
}

function Stat({ label, value, strong, className = "" }: { label: string; value: string; strong?: boolean; className?: string }) {
  return (
    <div className="rounded-md bg-surface px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</p>
      <p className={`num mt-1 font-bold ${strong ? "text-2xl text-accent" : "text-xl"} ${className}`}>{value}</p>
    </div>
  );
}

function LimitCards({ snap, year, now, limit, mei }: { snap: Snapshot; year: number; now: string; limit: number; mei: boolean }) {
  const y = yearProgress(snap, year, now, limit);
  const over = y.projectionCents > limit;
  return (
    <>
      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-3 font-semibold">
            <span className="grid size-9 place-items-center rounded-md bg-accent-soft text-accent"><TrendingUp aria-hidden className="size-4" /></span>
            {mei ? "Limite do MEI" : "Meta de Faturamento Anual"} {year}
          </h2>
          <span className={`rounded-pill border px-3 py-1 text-xs font-semibold ${y.pct >= 80 ? "border-warning text-warning" : "border-accent text-accent"}`}>{pct(y.pct)} utilizado</span>
        </div>
        <div className="relative h-6 overflow-hidden rounded-pill bg-surface" role="progressbar" aria-label="Limite anual utilizado" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, y.pct)}>
          <div className={`h-full ${tone(y.pct)} transition-all`} style={{ width: `${Math.min(100, y.pct)}%` }} />
          <span className="num absolute inset-0 grid place-items-center text-xs font-semibold">{formatBRL(y.billedCents)} de {formatBRL(limit)}</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Faturado" value={formatBRL(y.billedCents)} />
          <Stat label="Disponível" value={formatBRL(y.availableCents)} className="text-income" />
          <Stat label="Projeção anual" value={formatBRL(y.projectionCents)} className={over ? "text-danger" : "text-accent"} />
        </div>
        {y.pct >= 80 && (
          <p role="alert" className="flex items-start gap-2 rounded-md bg-warning-soft px-4 py-3 text-sm">
            <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
            {y.pct >= 100 ? `Você passou do limite anual em ${formatBRL(y.billedCents - limit)}. Fale com o seu contador sobre o desenquadramento.` : "Você já usou mais de 80% do limite anual. Acompanhe de perto os próximos meses."}
          </p>
        )}
        <p className="flex items-start gap-2 rounded-md bg-surface px-4 py-3 text-sm">
          <Lightbulb aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
          <span>Se mantiver o ritmo atual, você fechará o ano em <strong className="num">{formatBRL(y.projectionCents)}</strong>, {over ? <>passando o limite em <strong className="num">{formatBRL(y.projectionCents - limit)}</strong>.</> : "ficando dentro do limite."}</span>
        </p>
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="font-semibold">Evolução do Limite</h2>
        {y.months.length === 0 ? <p className="text-sm text-text-muted">Sem meses para mostrar.</p> : (
          <ol className="flex flex-col gap-3">
            {y.months.map((m) => (
              <li key={m.month} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between text-sm">
                  <span>{SHORT[Number(m.month.slice(5, 7)) - 1]}/{m.month.slice(2, 4)}</span>
                  <span className="num text-xs text-text-muted">{formatBRL(m.cumulativeCents)} · {pct(m.pct)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-pill bg-surface"><div className={`h-full ${tone(m.pct)}`} style={{ width: `${Math.min(100, m.pct)}%` }} /></div>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </>
  );
}
