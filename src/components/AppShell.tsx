"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import {
  Bell, Car, CircleDollarSign, CircleUserRound, FileText, Heart, PlayCircle, TrendingUp, WalletCards,
  ChevronDown, ChevronLeft, ChevronRight, CreditCard, Flag, HandCoins, Home, Landmark, ListOrdered, Menu, Plus, Tags,
  X, Activity, BarChart3, Boxes, CalendarClock, ChartLine, ClipboardList, FileCheck2, FileSpreadsheet, Link2,
  List, Package, PiggyBank, ReceiptText, RefreshCw, Search, Settings, ShoppingCart, Store, Trophy, UserCheck, UserRound,
  Users, Wallet, Wrench, LayoutDashboard, Calculator, type LucideIcon,
} from "lucide-react";
import { addMonths, monthLabel, monthOf, today } from "@/lib/dates";
import { defaultCategoryChanges } from "@/lib/categories";
import { repo, useLoadError, useSession, useSnapshot } from "@/lib/data";
import { expiredTrash } from "@/lib/data/repo";
import { CompanySwitcher, SpaceBar, useSpace } from "./business";
import { SyncBanner } from "./SyncBanner";
import { TransactionModal } from "./TransactionModal";
import { Button, Skeleton } from "./ui";

interface ShellState {
  month: string;
  setMonth: (m: string) => void;
  /** Abre o novo lançamento; accountId já escolhe a conta de origem. */
  openNew: (kind?: NewKind, accountId?: string) => void;
  toast: (msg: string, action?: { label: string; run: () => void }) => void;
}
type NewKind = "expense" | "income" | "transfer";
const ShellCtx = createContext<ShellState | null>(null);
export function useShell() {
  const c = useContext(ShellCtx);
  if (!c) throw new Error("useShell fora do AppShell");
  return c;
}

interface NavItem { href: string; label: string; icon: LucideIcon }
interface NavGroup { group: string; items: NavItem[] }
const mod = (slug: string) => `/empresa/m/${slug}`;

const nav: NavGroup[] = [
  { group: "Essencial", items: [
    { href: "/", label: "Painel", icon: Home },
    { href: "/transacoes", label: "Transações", icon: CircleDollarSign },
    { href: "/cartoes", label: "Cartões", icon: CreditCard },
    { href: "/extrato", label: "Extrato", icon: FileText },
    { href: "/contas", label: "Contas", icon: Landmark },
  ] },
  { group: "Planejamento", items: [
    { href: "/previsao", label: "Previsão", icon: WalletCards },
    { href: "/categorias", label: "Categorias", icon: Tags },
    { href: "/metas", label: "Metas", icon: Flag },
  ] },
  { group: "Mais", items: [
    { href: "/investimentos", label: "Investimentos", icon: TrendingUp },
    { href: "/dividas", label: "Dívidas", icon: HandCoins },
    { href: "/lembretes", label: "Lembretes", icon: Bell },
    { href: "/veiculos", label: "Veículos", icon: Car },
    { href: "/desejos", label: "Lista de desejos", icon: Heart },
  ] },
  { group: "Ajuda", items: [
    { href: "/tutorial", label: "Tutorial", icon: PlayCircle },
    { href: "/configuracoes", label: "Perfil", icon: CircleUserRound },
  ] },
];

/** Menu do espaço Empresarial: o que já existe usa as telas do app com os dados da empresa. */
const businessNav: NavGroup[] = [
  { group: "Painel", items: [{ href: "/", label: "Painel Empresarial", icon: LayoutDashboard }] },
  { group: "Marketing", items: [{ href: "/empresa/link-bio", label: "Link Bio", icon: Link2 }] },
  { group: "Operacional", items: [
    { href: mod("ponto-de-venda"), label: "Ponto de Venda", icon: Store },
    { href: "/empresa/caixa", label: "Caixa Diário", icon: Wallet },
    { href: "/empresa/estoque", label: "Estoque", icon: Boxes },
  ] },
  { group: "Vendas e clientes", items: [
    { href: "/empresa/pedidos", label: "Pedidos", icon: Package },
    { href: "/transacoes?tipo=receitas", label: "Vendas", icon: CircleDollarSign },
    { href: "/extrato", label: "Extrato", icon: List },
    { href: "/previsao", label: "Receitas Recorrentes", icon: RefreshCw },
    { href: "/empresa/clientes", label: "Clientes & Recebíveis", icon: Users },
    { href: "/empresa/atividades", label: "Agenda / Atividades", icon: CalendarClock },
  ] },
  { group: "Financeiro", items: [
    { href: "/empresa/despesas", label: "Despesas / Compras", icon: ShoppingCart },
    { href: "/contas", label: "Contas Bancárias", icon: Landmark },
    { href: "/dividas", label: "Financiamentos", icon: Car },
    { href: "/previsao", label: "Gastos Fixos", icon: CalendarClock },
    { href: "/empresa/fluxo-de-caixa", label: "Fluxo de Caixa", icon: ChartLine },
    { href: "/empresa/dre", label: "DRE Simplificado", icon: FileSpreadsheet },
  ] },
  { group: "Produtos e serviços", items: [
    { href: "/empresa/produtos", label: "Produtos", icon: Package },
    { href: "/empresa/servicos", label: "Serviços", icon: Wrench },
    { href: "/empresa/orcamentos", label: "Orçamentos", icon: FileCheck2 },
  ] },
  { group: "Fiscal e RH", items: [
    { href: mod("notas-fiscais"), label: "Notas Fiscais", icon: ReceiptText },
    { href: mod("obrigacoes-fiscais"), label: "Obrigações Fiscais", icon: ClipboardList },
    { href: "/empresa/pro-labore", label: "Pró-Labore", icon: UserRound },
    { href: mod("funcionarios"), label: "Funcionários", icon: UserCheck },
  ] },
  { group: "Relatórios", items: [
    { href: "/empresa/ranking-produtos", label: "Ranking Produtos", icon: Trophy },
    { href: mod("relatorios"), label: "Relatórios", icon: BarChart3 },
  ] },
  { group: "Sistema", items: [
    { href: "/categorias", label: "Categorias", icon: Tags },
    { href: "/empresa/precificacao", label: "Precificação", icon: Calculator },
    { href: "/empresa/configuracoes", label: "Configurações", icon: Settings },
  ] },
  { group: "Avançado", items: [
    { href: "/empresa/metricas", label: "Métricas Tempo Real", icon: Activity },
    { href: "/empresa/analytics", label: "Analytics", icon: TrendingUp },
    { href: mod("gestao-de-capital"), label: "Gestão de Capital", icon: PiggyBank },
  ] },
];

const categoriesRunning = new Set<string>();
const fold = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  const { kind } = useSpace();
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState("");
  const q = fold(query.trim());
  const groups = (kind === "business" ? businessNav : nav)
    .map((g) => ({ ...g, items: q ? g.items.filter((i) => fold(i.label).includes(q)) : g.items }))
    .filter((g) => g.items.length);
  return (
    <nav aria-label="Principal" className="flex flex-col gap-1">
      {kind === "business" && <CompanySwitcher onNavigate={onNavigate} />}
      <div className="relative mb-1">
        <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar no menu..." aria-label="Buscar no menu"
          className="h-9 w-full rounded-md border border-border bg-surface pl-8 pr-2 text-sm placeholder:text-text-muted" />
      </div>
      {groups.length === 0 && <p className="px-2 py-3 text-sm text-text-muted">Nada encontrado.</p>}
      {groups.map((g) => {
        const open = !!q || !closed[g.group];
        const id = `menu-${g.group.toLowerCase()}`;
        return (
          <div key={g.group}>
            <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setClosed((c) => ({ ...c, [g.group]: open }))}
              className="flex w-full items-center justify-between rounded-sm px-2 pb-1.5 pt-4 text-xs font-semibold uppercase tracking-wide text-text-muted hover:text-text">
              {g.group}<ChevronDown aria-hidden className={`size-4 transition-transform ${open ? "" : "-rotate-90"}`} />
            </button>
            {open && (
              <div id={id} className="flex flex-col gap-0.5">
                {g.items.map(({ href, label, icon: Icon }) => {
                  const base = href.split("?")[0];
                  const active = base === "/" ? path === "/" : path === base || path.startsWith(base + "/");
                  return (
                    <Link key={label} href={href} onClick={onNavigate} aria-current={active ? "page" : undefined}
                      className="relative flex items-center gap-3 rounded-md px-2 py-1.5 text-text hover:bg-surface aria-[current=page]:font-semibold aria-[current=page]:text-accent
                        aria-[current=page]:before:absolute aria-[current=page]:before:-left-1 aria-[current=page]:before:inset-y-1.5 aria-[current=page]:before:w-1 aria-[current=page]:before:rounded-pill aria-[current=page]:before:bg-accent">
                      <span className="grid size-9 shrink-0 place-items-center rounded-pill bg-accent text-on-accent"><Icon aria-hidden className="size-[18px]" /></span>
                      {label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      {kind === "business" && !q && (
        <p className="mt-4 border-t border-border px-2 pt-3 text-[11px] leading-tight text-text-muted">
          <span className="block font-semibold">v1.0 - Painel Empresarial</span>Gestão completa para seu CNPJ
        </p>
      )}
    </nav>
  );
}

function Logo() {
  return (
    <div className="flex items-center gap-2 px-2 text-lg font-bold">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icon.svg" alt="" className="size-7" />Sobra
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const session = useSession();
  const loadError = useLoadError();
  const router = useRouter();
  const path = usePathname();
  const [chosenMonth, setMonth] = useState<string | null>(null);
  const [modal, setModal] = useState<false | NewKind>(false);
  const [modalAccount, setModalAccount] = useState<string | undefined>();
  const [drawer, setDrawer] = useState(false);
  const [toastState, setToast] = useState<{ msg: string; action?: { label: string; run: () => void } } | null>(null);

  useEffect(() => { if (session === null) router.replace("/entrar"); }, [session, router]);

  // Uma vez por conta: cria as categorias padrão que faltam (e renomeia as antigas equivalentes).
  const workspaceId = useSnapshot()?.workspace.id;
  useEffect(() => {
    if (!workspaceId) return;
    const key = `sobra:categorias-padrao-v2:${workspaceId}`;
    try { if (localStorage.getItem(key) || categoriesRunning.has(key)) return; } catch { return; }
    categoriesRunning.add(key);
    void (async () => {
      try {
        const snap = repo.snapshot();
        for (const c of defaultCategoryChanges(snap?.categories ?? [], snap?.workspace.kind ?? "personal")) await repo.upsertCategory(c);
        localStorage.setItem(key, "1");
      } catch { /* tenta de novo na próxima vez que o app abrir */ }
      categoriesRunning.delete(key);
    })();
  }, [workspaceId]);

  // A lixeira guarda por 30 dias: ao abrir o app, apaga de vez o que passou disso.
  useEffect(() => {
    if (!workspaceId) return;
    const old = expiredTrash(repo.snapshot()?.trash ?? [], new Date());
    if (old.length) void repo.purgeTransactions(old).catch(() => undefined);
  }, [workspaceId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.key.toLowerCase() === "n" && !e.metaKey && !e.ctrlKey && !el.closest("input,textarea,select,[contenteditable],[role=dialog]")) {
        e.preventDefault();
        setModalAccount(undefined); setModal("expense");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!toastState) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toastState]);

  const toast = useCallback((msg: string, action?: { label: string; run: () => void }) => setToast({ msg, action }), []);
  const openNew = useCallback((kind: NewKind = "expense", accountId?: string) => { setModalAccount(accountId); setModal(kind); }, []);

  if (!session && loadError) {
    return (
      <main className="grid min-h-dvh place-items-center bg-surface px-4">
        <div role="alert" className="w-full max-w-sm rounded-lg border border-border bg-bg p-6 shadow-card">
          <h1 className="text-xl font-bold">Não deu para carregar seus dados</h1>
          <p className="mt-1 text-text-muted">Você entrou, mas o banco respondeu com um erro:</p>
          <p className="mt-2 break-words rounded-sm bg-surface p-2 font-mono text-xs">{loadError}</p>
          <div className="mt-4 flex gap-2">
            <Button onClick={() => repo.retry()}>Tentar de novo</Button>
            <Button variant="secondary" onClick={async () => { await repo.signOut(); router.replace("/entrar"); }}>Sair</Button>
          </div>
        </div>
      </main>
    );
  }

  if (!session) {
    return <div className="p-6"><Skeleton className="h-8 w-40" /></div>;
  }

  // Só calcula "hoje" no navegador (no servidor a sessão ainda é undefined e paramos acima).
  const month = chosenMonth ?? monthOf(today());
  // No painel o mês é escolhido nos botões de mês da própria página.
  const showMonth = ["/extrato", "/categorias", "/fechamento"].includes(path);
  // Lembretes, Link Bio e o cadastro de produto não são lançamentos, então o botão de lançamento sai do topo e do celular.
  const showNew = !path.startsWith("/lembretes") && !path.startsWith("/empresa/link-bio") && !path.startsWith("/empresa/produtos/produto") && !path.startsWith("/empresa/servicos/servico") && !path.startsWith("/empresa/orcamentos") && !path.startsWith("/empresa/atividades") && !path.startsWith("/empresa/clientes") && !path.startsWith("/empresa/despesas") && !path.startsWith("/empresa/caixa") && !path.startsWith("/empresa/pedidos") && !path.startsWith("/empresa/pro-labore") && !path.startsWith("/empresa/metricas") && !path.startsWith("/empresa/analytics") && !path.startsWith("/empresa/ranking-produtos");

  return (
    <ShellCtx.Provider value={{ month, setMonth, openNew, toast }}>
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-bg focus:p-2">Pular para o conteúdo</a>
      <div className="min-h-dvh lg:grid lg:grid-cols-[var(--layout-sidebar)_1fr]">
        <aside className="hidden border-r border-border bg-bg px-3 py-4 lg:block">
          <div className="sticky top-4 max-h-[calc(100dvh-2rem)] overflow-y-auto pl-2"><Logo /><div className="mt-3"><NavLinks /></div></div>
        </aside>

        {drawer && (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
            <button aria-label="Fechar menu" className="absolute inset-0 bg-text/40" onClick={() => setDrawer(false)} />
            <div className="absolute inset-y-0 left-0 w-72 overflow-y-auto bg-bg px-3 py-4 shadow-pop">
              <div className="flex items-center justify-between"><Logo />
                <button aria-label="Fechar menu" onClick={() => setDrawer(false)} className="rounded-sm p-2 hover:bg-surface"><X className="size-5" /></button>
              </div>
              <div className="mt-4"><NavLinks onNavigate={() => setDrawer(false)} /></div>
            </div>
          </div>
        )}

        <div className="min-w-0">
          <header className="sticky top-0 z-30 flex h-[var(--layout-header)] items-center justify-between gap-3 border-b border-border bg-bg px-4 lg:px-6">
            <div className="flex items-center gap-2">
              <button aria-label="Abrir menu" onClick={() => setDrawer(true)} className="-ml-2 rounded-sm p-2 hover:bg-surface lg:hidden"><Menu className="size-5" /></button>
              {showMonth ? (
                <div className="flex items-center gap-2 font-semibold">
                  <button aria-label="Mês anterior" onClick={() => setMonth(addMonths(month, -1))} className="grid size-8 place-items-center rounded-sm border border-border hover:bg-surface"><ChevronLeft className="size-4" /></button>
                  <span className="min-w-28 text-center" aria-live="polite">{monthLabel(month)}</span>
                  <button aria-label="Próximo mês" onClick={() => setMonth(addMonths(month, 1))} className="grid size-8 place-items-center rounded-sm border border-border hover:bg-surface"><ChevronRight className="size-4" /></button>
                </div>
              ) : null}
            </div>
            <div className="flex items-center gap-3">
            <SpaceBar onError={toast} />
            {showNew && <button onClick={() => openNew()} className="hidden h-10 items-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-on-accent hover:bg-accent-hover lg:inline-flex">
              <Plus aria-hidden className="size-4" />Novo lançamento
            </button>}
            </div>
          </header>
          <SyncBanner />

          <main id="conteudo" className="mx-auto max-w-[var(--layout-content-max)] px-4 pb-28 pt-4 lg:px-6 lg:pb-10 lg:pt-6">{children}</main>
        </div>
      </div>

      <nav aria-label="Atalhos" className="fixed inset-x-0 bottom-0 z-30 grid h-[var(--layout-bottom-nav)] grid-cols-5 items-center border-t border-border bg-bg text-xs text-text-muted lg:hidden">
        {[{ href: "/", label: "Início", icon: Home }, { href: "/transacoes", label: "Transações", icon: ListOrdered }, null,
          { href: "/cartoes", label: "Cartões", icon: CreditCard }, { href: "/metas", label: "Metas", icon: Flag }].map((it, i) =>
          it ? (
            <Link key={it.href} href={it.href} aria-current={(it.href === "/" ? path === "/" : path.startsWith(it.href)) ? "page" : undefined}
              className="flex flex-col items-center gap-1 aria-[current=page]:font-semibold aria-[current=page]:text-accent">
              <it.icon aria-hidden className="size-5" />{it.label}
            </Link>
          ) : <span key={i} />,
        )}
      </nav>
      {showNew && <button onClick={() => openNew()} aria-label="Novo lançamento"
        className="fixed bottom-7 left-1/2 z-40 grid size-14 -translate-x-1/2 place-items-center rounded-pill bg-accent text-on-accent shadow-pop lg:hidden">
        <Plus className="size-7" />
      </button>}

      {modal && <TransactionModal initialKind={modal} initialAccountId={modalAccount} onClose={() => setModal(false)} onSaved={(msg, undo) => toast(msg, undo ? { label: "Desfazer", run: undo } : undefined)} />}

      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 lg:bottom-6">
        {toastState && (
          <div role="status" className="pointer-events-auto flex items-center gap-4 rounded-md bg-text px-4 py-3 text-sm text-bg shadow-pop">
            {toastState.msg}
            {toastState.action && (
              <button className="font-semibold underline" onClick={() => { toastState.action!.run(); setToast(null); }}>{toastState.action.label}</button>
            )}
          </div>
        )}
      </div>
    </ShellCtx.Provider>
  );
}
