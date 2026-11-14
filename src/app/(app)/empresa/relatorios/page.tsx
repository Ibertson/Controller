"use client";

import { useEffect, useRef, useState } from "react";
import { Building2, Download, FileSpreadsheet, FileText, Filter, Receipt, TrendingUp, Users, type LucideIcon } from "lucide-react";
import { useShell } from "@/components/AppShell";
import { useSpace } from "@/components/business";
import { download } from "@/components/QuickActions";
import { ReportBody, ReportPrint } from "@/components/ReportView";
import { Card, Skeleton } from "@/components/ui";
import { repo, useSnapshot } from "@/lib/data";
import { today } from "@/lib/dates";
import { MONTHS, buildReport, reportSheets, type Period, type PeriodKind, type ReportData, type ReportId } from "@/lib/reports";
import { writeXlsx } from "@/lib/xlsx";

const CARDS: { id: ReportId; icon: LucideIcon; title: string; desc: string; bullets: string[]; excelOnly?: boolean }[] = [
  { id: "geral", icon: FileText, title: "Relatório Geral", desc: "Visão completa: faturamento, despesas, DAS e limite", bullets: ["Faturamento mensal", "Despesas totais", "Limite utilizado", "DAS pagos"] },
  { id: "vendas", icon: TrendingUp, title: "Relatório de Vendas", desc: "Detalhamento completo de cada venda realizada", bullets: ["Cada venda individual", "Valor por cliente", "Conta de recebimento", "Status de recebimento"] },
  { id: "clientes", icon: Users, title: "Ranking de Clientes", desc: "Faturamento agrupado por cliente", bullets: ["Top clientes", "Quantidade de vendas", "Valor total por cliente", "% do faturamento"] },
  { id: "notas", icon: Receipt, title: "Relatório de Notas", desc: "Todas as notas fiscais emitidas no período", bullets: ["Notas emitidas", "Valores totais", "Clientes atendidos", "Cancelamentos"] },
  { id: "despesas", icon: FileText, title: "Relatório de Despesas", desc: "Detalhamento completo de custos e compras", bullets: ["Despesas por categoria", "Fornecedores", "Formas de pagamento", "% do faturamento"] },
  { id: "contador", icon: FileSpreadsheet, title: "Relatório para Contador", desc: "Dados organizados para envio ao contador", bullets: ["Receitas e despesas completas", "Despesas comprovadas", "DAS pagos", "Pró-labore"], excelOnly: true },
];
const KINDS: [PeriodKind, string][] = [["mensal", "Mensal"], ["trimestral", "Trimestral"], ["anual", "Anual"]];
const selectClass = "h-10 w-full rounded-md border border-border-input bg-surface-raised px-3 text-sm focus-visible:outline-2 focus-visible:outline-accent";
const slug = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

type Extra = Omit<ReportData, "snap" | "companyType">;

/** Recebíveis, clientes, detalhes das despesas e pró-labore do espaço aberto. */
function useReportExtra() {
  const wsId = useSnapshot()?.workspace.id;
  const [state, setState] = useState<{ ws?: string; data?: Extra }>({});
  useEffect(() => {
    if (!wsId) return;
    let alive = true;
    const safe = <T,>(p: Promise<T[]>) => p.catch(() => [] as T[]);
    Promise.all([safe(repo.listReceivables()), safe(repo.listClients()), safe(repo.listExpenseDetails()), safe(repo.listProLabore())])
      .then(([receivables, clients, details, prolabore]) => { if (alive) setState({ ws: wsId, data: { receivables, clients, details, prolabore } }); });
    return () => { alive = false; };
  }, [wsId]);
  return state.ws === wsId ? state.data : undefined;
}

/** Relatórios: geral, vendas, clientes, notas, despesas e para o contador, em PDF e Excel. */
export default function Relatorios() {
  const { kind, company } = useSpace();
  const snap = useSnapshot();
  const extra = useReportExtra();
  const { toast } = useShell();
  const now = today();
  const curYear = Number(now.slice(0, 4));
  const [period, setPeriod] = useState<Period>(() => { const m = Number(now.slice(5, 7)); return { kind: "mensal", year: curYear, month: m, quarter: Math.ceil(m / 3) }; });
  const [preview, setPreview] = useState<ReportId>("geral");
  const [printing, setPrinting] = useState<ReportId | null>(null);
  const chips = useRef<HTMLElement>(null);
  const previewRef = useRef<HTMLElement>(null);
  useEffect(() => { chips.current?.querySelector<HTMLElement>("[aria-pressed=true]")?.scrollIntoView({ block: "nearest", inline: "center" }); }, [kind]);

  if (kind !== "business" || !company) {
    return (
      <Card className="flex flex-col items-center gap-3 py-10 text-center">
        <Building2 aria-hidden className="size-9 text-text-muted" />
        <h1 className="font-semibold">Relatórios fazem parte do Painel Empresarial</h1>
        <p className="max-w-md text-sm text-text-muted">Abra a aba Empresarial no topo da tela para gerar os relatórios da empresa.</p>
      </Card>
    );
  }
  if (!snap || !extra) return <div className="flex flex-col gap-4"><Skeleton className="h-20" /><Skeleton className="h-28" /><Skeleton className="h-96" /></div>;

  const mei = company.companyType === "mei";
  const data: ReportData = { snap, companyType: company.companyType, ...extra };
  const report = (id: ReportId) => buildReport(id, data, period);
  const current = report(preview);
  const years = Array.from(new Set([curYear, curYear - 1, curYear - 2, period.year])).sort((a, b) => b - a);
  const set = (patch: Partial<Period>) => setPeriod((p) => ({ ...p, ...patch }));

  function excel(id: ReportId) {
    const r = report(id);
    download(writeXlsx(reportSheets(r, company!.name)), `${slug(r.title)}-${slug(r.period)}.xlsx`);
    toast("Planilha gerada");
  }
  function show(id: ReportId) {
    setPreview(id);
    previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="flex flex-col gap-4">
      <nav ref={chips} aria-label="Mês" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {MONTHS.map((m, i) => (
          <button key={m} type="button" aria-pressed={period.kind === "mensal" && period.month === i + 1} onClick={() => set({ kind: "mensal", month: i + 1, quarter: Math.ceil((i + 1) / 3) })}
            className="h-9 shrink-0 rounded-md border border-border px-4 text-sm hover:bg-surface aria-pressed:border-accent aria-pressed:bg-accent-soft aria-pressed:font-semibold aria-pressed:text-accent">{m}</button>
        ))}
      </nav>

      <Card>
        <h1 className="text-2xl font-bold">{mei ? "Relatórios MEI" : "Relatórios"}</h1>
        <p className="text-sm text-text-muted">Gere relatórios completos {mei ? "do seu MEI" : "da sua empresa"} com dados reais</p>
      </Card>

      <Card>
        <h2 className="mb-3 flex items-center gap-2 font-semibold"><Filter aria-hidden className="size-4" />Filtros</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm"><span className="text-text-muted">Período</span>
            <select value={period.kind} onChange={(e) => set({ kind: e.target.value as PeriodKind })} className={selectClass}>
              {KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          {period.kind === "mensal" && (
            <label className="flex flex-col gap-1 text-sm"><span className="text-text-muted">Mês</span>
              <select value={period.month} onChange={(e) => set({ month: Number(e.target.value), quarter: Math.ceil(Number(e.target.value) / 3) })} className={selectClass}>
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </label>
          )}
          {period.kind === "trimestral" && (
            <label className="flex flex-col gap-1 text-sm"><span className="text-text-muted">Trimestre</span>
              <select value={period.quarter} onChange={(e) => set({ quarter: Number(e.target.value) })} className={selectClass}>
                {[1, 2, 3, 4].map((q) => <option key={q} value={q}>{q}º trimestre ({MONTHS[(q - 1) * 3].slice(0, 3)} a {MONTHS[(q - 1) * 3 + 2].slice(0, 3)})</option>)}
              </select>
            </label>
          )}
          <label className={`flex flex-col gap-1 text-sm ${period.kind === "anual" ? "sm:col-span-2" : ""}`}><span className="text-text-muted">Ano</span>
            <select value={period.year} onChange={(e) => set({ year: Number(e.target.value) })} className={selectClass}>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {CARDS.map(({ id, icon: Icon, title, desc, bullets, excelOnly }) => (
          <Card key={id} className={`flex flex-col gap-3 ${preview === id ? "ring-2 ring-accent" : ""}`}>
            <div className="flex items-start gap-3">
              <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-md bg-accent-soft text-accent"><Icon className="size-5" /></span>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold">{title}</h2>
                <p className="text-xs text-text-muted">{desc}</p>
              </div>
              <button type="button" onClick={() => show(id)} aria-pressed={preview === id} className="shrink-0 text-xs font-semibold text-accent hover:underline">Ver prévia</button>
            </div>
            <ul className="flex flex-col gap-1 text-sm text-text-muted">
              {bullets.map((b) => <li key={b} className="flex items-center gap-2"><span aria-hidden className="size-1.5 rounded-pill bg-accent" />{b}</li>)}
            </ul>
            <div className="mt-auto grid grid-cols-2 gap-2">
              {excelOnly ? (
                <button type="button" onClick={() => excel(id)} aria-label={`Gerar Excel: ${title}`} className="col-span-2 h-10 rounded-md bg-accent text-sm font-semibold text-on-accent hover:bg-accent-hover">Gerar Excel</button>
              ) : <>
                <button type="button" onClick={() => { setPreview(id); setPrinting(id); }} aria-label={`PDF: ${title}`} className="h-10 rounded-md bg-accent text-sm font-semibold text-on-accent hover:bg-accent-hover">PDF</button>
                <button type="button" onClick={() => excel(id)} aria-label={`Excel: ${title}`} className="h-10 rounded-md border border-border text-sm font-semibold hover:bg-surface">Excel</button>
              </>}
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <section ref={previewRef} aria-labelledby="rel-preview" className="scroll-mt-24">
          <h2 id="rel-preview" className="mb-4 text-lg font-semibold">Preview - {current.title} {current.period}</h2>
          <ReportBody report={current} maxRows={8} />
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <button type="button" onClick={() => setPrinting(preview)} className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-accent text-sm font-semibold text-on-accent hover:bg-accent-hover">
              <Download aria-hidden className="size-4" />Exportar PDF</button>
            <button type="button" onClick={() => excel(preview)} className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-border text-sm font-semibold hover:bg-surface">
              <FileSpreadsheet aria-hidden className="size-4" />Exportar Excel</button>
          </div>
        </section>
      </Card>

      {printing && <ReportPrint report={report(printing)} company={company.details?.legalName || company.name} cnpj={company.cnpj} onClose={() => setPrinting(null)} />}
    </div>
  );
}
