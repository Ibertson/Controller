"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { Bell, Building2, FileText, Globe, LogOut, RefreshCw, Save, Shield, Trophy, Users, type LucideIcon } from "lucide-react";
import { useShell } from "@/components/AppShell";
import { CompanyModal, Hint, useSpace } from "@/components/business";
import { Button, Card, Field, Input, inputClass, Skeleton } from "@/components/ui";
import {
  COMPANY_TYPES, cnpjDigits, companyTypeInfo, formatCnae, formatCnpj, isValidCnpj, lookupCnpj, parseCents,
} from "@/lib/business";
import { repo, useProfile, useSnapshot } from "@/lib/data";
import { formatBRL } from "@/lib/money";
import type { Company, CompanyDetails, CompanyType } from "@/lib/types";

const UFS = "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ");
const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Não foi possível salvar.");

/** Configurações do Empresarial: dados, fiscais, preferências, catálogo, sócios e segurança. */
export default function ConfiguracoesEmpresa() {
  const snap = useSnapshot();
  const { kind, hasBusiness, company } = useSpace();
  const [onboarding, setOnboarding] = useState(false);
  if (!snap) return <Skeleton className="h-64" />;
  if (kind !== "business" || !company) {
    return (
      <div className="flex flex-col gap-4">
        <Header title="Configurações da empresa" />
        <Card className="flex flex-col items-center gap-3 py-10 text-center">
          <Building2 aria-hidden className="size-9 text-text-muted" />
          <h2 className="font-semibold">{hasBusiness ? "Abra o Empresarial para ver os dados da empresa" : "Cadastre sua empresa"}</h2>
          <p className="max-w-md text-sm text-text-muted">{hasBusiness
            ? "Use a aba Empresarial no topo da tela."
            : "Para acessar o Painel Empresarial, primeiro cadastre os dados da sua empresa."}</p>
          {!hasBusiness && <Button onClick={() => setOnboarding(true)}>Cadastrar empresa</Button>}
        </Card>
        {onboarding && <CompanyModal onClose={() => setOnboarding(false)} onDone={() => setOnboarding(false)} />}
      </div>
    );
  }
  const short = companyTypeInfo(company.companyType)?.short;
  return (
    <div key={snap.workspace.id} className="flex flex-col gap-4">
      <Header title={short ? `Configurações ${short}` : "Configurações da empresa"} />
      <CompanyData company={company} />
      <FiscalData company={company} />
      <Preferences company={company} />
      <Catalog company={company} />
      <div className="flex items-center gap-3 rounded-lg bg-accent p-4 text-on-accent shadow-card">
        <span className="grid size-10 shrink-0 place-items-center rounded-pill bg-white/15"><Trophy aria-hidden className="size-5" /></span>
        <div><p className="font-semibold">Painel PJ Exclusivo</p><p className="text-sm opacity-90">Personalizado para sua empresa</p></div>
      </div>
      <Partners />
      <Security />
    </div>
  );
}

function Header({ title }: { title: string }) {
  return (
    <Card>
      <h1 className="text-lg font-bold">{title}</h1>
      <p className="text-sm text-text-muted">Gerencie os dados e preferências da sua empresa</p>
    </Card>
  );
}

function Section({ icon: Icon, title, subtitle, action, children }: { icon: LucideIcon; title: string; subtitle?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-md bg-accent-soft text-accent"><Icon aria-hidden className="size-5" /></span>
          <div>
            <h2 className="font-semibold">{title}</h2>
            {subtitle && <p className="text-xs text-text-muted">{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

/** Salva a empresa trocando só o que mudou. */
function useSave(company: Company) {
  const { toast } = useShell();
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState("");
  async function save(patch: Partial<Company>, details: CompanyDetails, msg: string) {
    setBusy(true); setFail("");
    try {
      await repo.updateCompany({ ...company, ...patch, details: { ...company.details, ...details } });
      toast(msg);
    } catch (e) { setFail(errMsg(e)); }
    finally { setBusy(false); }
  }
  return { busy, fail, save };
}

function SaveButton({ busy, children = "Salvar alterações" }: { busy: boolean; children?: ReactNode }) {
  return <Button type="submit" loading={busy} className="self-start"><Save aria-hidden className="size-4" />{children}</Button>;
}

function CompanyData({ company }: { company: Company }) {
  const d = company.details ?? {};
  const [name, setName] = useState(company.name);
  const [legalName, setLegalName] = useState(d.legalName ?? "");
  const [cnpj, setCnpj] = useState(company.cnpj ? formatCnpj(company.cnpj) : "");
  const [email, setEmail] = useState(d.email ?? "");
  const [city, setCity] = useState(d.city ?? "");
  const [uf, setUf] = useState(d.uf ?? "");
  const [activity, setActivity] = useState(company.activity);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [lookup, setLookup] = useState<{ busy: boolean; msg?: { ok: boolean; text: string } }>({ busy: false });
  const { busy, fail, save } = useSave(company);

  async function fromReceita() {
    if (!isValidCnpj(cnpj)) { setErrors((e) => ({ ...e, cnpj: "Digite um CNPJ válido para consultar a Receita." })); return; }
    setLookup({ busy: true });
    try {
      const r = await lookupCnpj(cnpj);
      if (r.tradeName) setName(r.tradeName); else if (r.legalName && !name.trim()) setName(r.legalName);
      if (r.legalName) setLegalName(r.legalName);
      if (r.email) setEmail(r.email);
      if (r.city) setCity(r.city);
      if (r.uf) setUf(r.uf);
      setErrors({});
      setLookup({ busy: false, msg: { ok: true, text: "Dados trazidos da Receita. Confira e salve." } });
      if (r.cnae || r.openedOn) {
        // CNAE e abertura ficam em Dados fiscais: grava direto o que veio da Receita.
        await repo.updateCompany({ ...company, details: { ...company.details, ...(r.cnae && { cnae: r.cnae }), ...(r.openedOn && { openedOn: r.openedOn }) } });
      }
    } catch (e) { setLookup({ busy: false, msg: { ok: false, text: errMsg(e) } }); }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const err: Record<string, string> = {};
    if (!name.trim()) err.name = "Informe o nome da empresa.";
    if (cnpjDigits(cnpj) && !isValidCnpj(cnpj)) err.cnpj = "CNPJ inválido. Corrija ou deixe em branco.";
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) err.email = "E-mail inválido.";
    if (!activity.trim()) err.activity = "Informe a atividade principal.";
    setErrors(err);
    if (Object.keys(err).length) return;
    void save({ name: name.trim(), cnpj: cnpjDigits(cnpj) || null, activity: activity.trim() },
      { legalName: legalName.trim(), email: email.trim(), city: city.trim(), uf }, "Dados da empresa salvos");
  }

  return (
    <Section icon={Building2} title="Dados da empresa" action={
      <button type="button" onClick={() => void fromReceita()} disabled={lookup.busy}
        className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text disabled:opacity-60">
        <RefreshCw aria-hidden className={`size-4 ${lookup.busy ? "animate-spin" : ""}`} />Atualizar pela Receita
      </button>
    }>
      {lookup.msg && <p role="status" className={`text-xs ${lookup.msg.ok ? "text-income" : "text-danger"}`}>{lookup.msg.text}</p>}
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nome fantasia" htmlFor="cf-name" error={errors.name}>
            <Input id="cf-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} aria-invalid={!!errors.name || undefined} />
          </Field>
          <Field label="Razão social" htmlFor="cf-legal">
            <Input id="cf-legal" value={legalName} maxLength={120} placeholder="Como está no cartão CNPJ" onChange={(e) => setLegalName(e.target.value)} />
          </Field>
          <Field label="CNPJ" htmlFor="cf-cnpj" error={errors.cnpj}>
            <Input id="cf-cnpj" inputMode="numeric" className="num" placeholder="00.000.000/0000-00" value={cnpj}
              onChange={(e) => setCnpj(formatCnpj(e.target.value))} aria-invalid={!!errors.cnpj || undefined} />
          </Field>
          <Field label="E-mail" htmlFor="cf-email" error={errors.email}>
            <Input id="cf-email" type="email" placeholder="contato@empresa.com" value={email} maxLength={120}
              onChange={(e) => setEmail(e.target.value)} aria-invalid={!!errors.email || undefined} />
          </Field>
          <Field label="Cidade" htmlFor="cf-city">
            <Input id="cf-city" placeholder="São Paulo" value={city} maxLength={80} onChange={(e) => setCity(e.target.value)} />
          </Field>
          <Field label="UF" htmlFor="cf-uf">
            <select id="cf-uf" className={inputClass} value={uf} onChange={(e) => setUf(e.target.value)}>
              <option value="">Selecione</option>
              {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Atividade principal" htmlFor="cf-activity" error={errors.activity}>
              <Input id="cf-activity" value={activity} maxLength={120} onChange={(e) => setActivity(e.target.value)} aria-invalid={!!errors.activity || undefined} />
            </Field>
          </div>
        </div>
        {fail && <p role="alert" className="text-sm text-danger">{fail}</p>}
        <SaveButton busy={busy} />
      </form>
    </Section>
  );
}

function FiscalData({ company }: { company: Company }) {
  const d = company.details ?? {};
  const [cnae, setCnae] = useState(d.cnae ? formatCnae(d.cnae) : "");
  const [openedOn, setOpenedOn] = useState(d.openedOn ?? "");
  const [type, setType] = useState<CompanyType>(company.companyType);
  const [das, setDas] = useState(d.dasCents ? formatBRL(d.dasCents).replace(/^R\$\s*/, "") : "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { busy, fail, save } = useSave(company);
  // Os dados vindos da Receita chegam depois: mostra o que está salvo se o campo não foi mexido.
  const [touched, setTouched] = useState({ cnae: false, opened: false });
  const cnaeValue = touched.cnae ? cnae : d.cnae ? formatCnae(d.cnae) : cnae;
  const openedValue = touched.opened ? openedOn : d.openedOn ?? openedOn;
  const info = companyTypeInfo(type);
  const options = COMPANY_TYPES.some((t) => t.value === type) ? COMPANY_TYPES : [...COMPANY_TYPES, info!];

  function submit(e: FormEvent) {
    e.preventDefault();
    const err: Record<string, string> = {};
    const digits = cnaeValue.replace(/\D/g, "");
    const dasCents = parseCents(das);
    if (digits && digits.length !== 7) err.cnae = "O CNAE tem 7 dígitos.";
    if (type === "mei" && !dasCents) err.das = "Informe o valor do DAS mensal.";
    setErrors(err);
    if (Object.keys(err).length) return;
    void save({ companyType: type }, { cnae: digits, openedOn: openedValue, dasCents: type === "mei" ? dasCents ?? undefined : undefined }, "Dados fiscais salvos");
  }

  return (
    <Section icon={FileText} title="Dados fiscais">
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="CNAE" htmlFor="cf-cnae" error={errors.cnae}>
            <Input id="cf-cnae" inputMode="numeric" className="num" placeholder="0000-0/00" value={cnaeValue}
              onChange={(e) => { setTouched((t) => ({ ...t, cnae: true })); setCnae(formatCnae(e.target.value)); }} aria-invalid={!!errors.cnae || undefined} />
            <p className="text-xs text-text-muted">Formato: XXXX-X/XX (7 dígitos)</p>
          </Field>
          <Field label="Data de abertura" htmlFor="cf-opened">
            <Input id="cf-opened" type="date" className="num" value={openedValue}
              onChange={(e) => { setTouched((t) => ({ ...t, opened: true })); setOpenedOn(e.target.value); }} />
          </Field>
          <Field label="Tipo de empresa" htmlFor="cf-type">
            <select id="cf-type" className={inputClass} value={type} onChange={(e) => setType(e.target.value as CompanyType)}>
              {options.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            {info?.hint && <Hint>{info.hint}</Hint>}
          </Field>
          {type === "mei" && (
            <Field label="Valor do DAS mensal" htmlFor="cf-das" error={errors.das}>
              <div className="relative">
                <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-muted">R$</span>
                <Input id="cf-das" inputMode="decimal" className="num pl-10" placeholder="75,60" value={das}
                  onChange={(e) => setDas(e.target.value.replace(/[^\d,.]/g, ""))} aria-invalid={!!errors.das || undefined} />
              </div>
              <Hint>Valor médio do DAS em 2024: R$ 71,60 (Comércio) a R$ 76,60 (Misto)</Hint>
            </Field>
          )}
        </div>
        {fail && <p role="alert" className="text-sm text-danger">{fail}</p>}
        <SaveButton busy={busy} />
      </form>
    </Section>
  );
}

function Toggle({ id, title, description, checked, onChange }: { id: string; title: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={id} className="min-w-0">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-text-muted">{description}</span>
      </label>
      <button id={id} type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className="relative h-7 w-12 shrink-0 rounded-pill bg-border transition-colors aria-checked:bg-accent">
        <span aria-hidden className={`absolute top-1 size-5 rounded-pill bg-white shadow-card transition-all ${checked ? "left-6" : "left-1"}`} />
      </button>
    </div>
  );
}

function Preferences({ company }: { company: Company }) {
  const d = company.details ?? {};
  const { toast } = useShell();
  const [push, setPush] = useState(!!d.pushAlerts);
  const [report, setReport] = useState(!!d.monthlyReport);
  const [url, setUrl] = useState(d.nfseUrl ?? "");
  const [error, setError] = useState("");
  const { busy, fail, save } = useSave(company);

  async function togglePush(on: boolean) {
    if (!on) { setPush(false); return; }
    if (typeof Notification === "undefined") { toast("Este navegador não mostra notificações."); return; }
    const perm = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
    if (perm !== "granted") { toast("Notificações bloqueadas. Libere nas configurações do navegador."); return; }
    setPush(true);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const link = url.trim();
    if (link && !/^https?:\/\/[^\s.]+\.[^\s]+$/i.test(link)) { setError("Digite o endereço completo, começando com https://"); return; }
    setError("");
    void save({}, { pushAlerts: push, monthlyReport: report, nfseUrl: link }, "Preferências salvas");
  }

  return (
    <Section icon={Bell} title="Preferências e notificações">
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Toggle id="cf-push" title="Notificações push" description="Receba alertas de recebíveis e vencimentos" checked={push} onChange={(v) => void togglePush(v)} />
        <Toggle id="cf-report" title="Relatório mensal automático" description="Enviar relatório por e-mail no início de cada mês" checked={report} onChange={setReport} />
        <div className="border-t border-border pt-4">
          <Field label="Link da prefeitura para emissão de nota" htmlFor="cf-nfse" error={error}>
            <Input id="cf-nfse" type="url" inputMode="url" placeholder="https://nfe.prefeitura.sp.gov.br" value={url} maxLength={300}
              onChange={(e) => setUrl(e.target.value)} aria-invalid={!!error || undefined} />
            <p className="text-xs text-text-muted">Este link será usado nos atalhos rápidos para emitir nota fiscal</p>
          </Field>
        </div>
        {fail && <p role="alert" className="text-sm text-danger">{fail}</p>}
        <SaveButton busy={busy}>Salvar preferências</SaveButton>
      </form>
    </Section>
  );
}

function Catalog({ company }: { company: Company }) {
  const on = !!company.details?.publicCatalog;
  const { save } = useSave(company);
  return (
    <Section icon={Globe} title="Catálogo Online" subtitle="Compartilhe seus produtos com clientes via link.">
      <Toggle id="cf-catalog" title="Ativar catálogo público" description="Seus produtos ficarão visíveis para qualquer pessoa com o link"
        checked={on} onChange={(v) => void save({}, { publicCatalog: v }, v ? "Catálogo público ativado" : "Catálogo público desativado")} />
      {on && <Hint>O link do catálogo aparece aqui quando o cadastro de Produtos estiver pronto.</Hint>}
    </Section>
  );
}

function Partners() {
  return (
    <Section icon={Users} title="Sócios" subtitle="Quem pode acessar o painel desta empresa">
      <div className="flex flex-col items-center gap-1 py-6 text-center">
        <Users aria-hidden className="mb-2 size-9 text-text-muted" />
        <p className="text-sm font-medium">Nenhum sócio vinculado</p>
        <p className="text-xs text-text-muted">Convide até 3 sócios para acessar o painel desta empresa</p>
      </div>
    </Section>
  );
}

function Security() {
  const profile = useProfile();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Section icon={Shield} title="Segurança">
      <Field label="E-mail da conta" htmlFor="cf-account">
        <Input id="cf-account" readOnly disabled value={profile?.email ?? "Sem e-mail neste modo"} className="bg-surface text-text-muted sm:max-w-md" />
        <p className="text-xs text-text-muted">O e-mail da conta não pode ser alterado</p>
      </Field>
      <div className="flex flex-wrap gap-3">
        <Link href="/configuracoes#seguranca" className="inline-flex h-10 items-center rounded-pill border border-danger px-5 text-sm font-semibold text-danger hover:bg-danger-soft">Alterar senha</Link>
        <Button variant="danger" loading={busy} className="!rounded-pill px-5"
          onClick={async () => { setBusy(true); await repo.signOut(); router.replace("/entrar"); }}>
          <LogOut aria-hidden className="size-4" />Sair da Conta
        </Button>
      </div>
    </Section>
  );
}
