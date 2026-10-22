"use client";

import { useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays, Camera, CreditCard, DollarSign, Eye, EyeOff, KeyRound, LogOut, Mail, MapPin, MessageCircle, Phone, Plus,
  RefreshCw, Smartphone, Star, Target, Trash2, TrendingUp, User, type LucideIcon,
} from "lucide-react";
import { useShell } from "@/components/AppShell";
import { Dialog } from "@/components/Dialog";
import { Button, Card, Field, Input, Skeleton, inputClass } from "@/components/ui";
import { repo, useProfile, useSession, useSnapshot } from "@/lib/data";
import { formatBRL } from "@/lib/money";
import {
  MAX_WHATSAPP, addWhatsapp, checkPassword, initials, memberSinceLabel, profileStats, removeWhatsapp, setPrimaryWhatsapp,
  type PasswordCheck,
} from "@/lib/profile";
import { formatWhatsapp, normalizeWhatsapp } from "@/lib/reminders";
import type { Profile, Snapshot } from "@/lib/types";

const VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0";
const BUILD = process.env.NEXT_PUBLIC_APP_BUILD ?? "local";

const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Não foi possível salvar.");

/** "11987654321" → "(11) 98765-4321", formatando enquanto digita. */
function maskPhone(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  const head = d.length === 11 ? 7 : 6;
  return `(${d.slice(0, 2)}) ${d.slice(2, head)}-${d.slice(head)}`;
}

/** Reduz a foto para 256×256 (recorte central) e devolve em JPEG. */
function resizeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.width, img.height), size = 256;
      const c = document.createElement("canvas");
      c.width = c.height = size;
      c.getContext("2d")!.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Não deu para abrir essa imagem.")); };
    img.src = url;
  });
}

function SectionTitle({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold"><Icon aria-hidden className="size-5" />{children}</h2>;
}

function IconLabel({ icon: Icon, htmlFor, children }: { icon: LucideIcon; htmlFor: string; children: ReactNode }) {
  return <label htmlFor={htmlFor} className="flex items-center gap-1.5 text-sm font-semibold"><Icon aria-hidden className="size-4 text-text-muted" />{children}</label>;
}

export default function Perfil() {
  const session = useSession();
  const profile = useProfile();
  const snap = useSnapshot();
  if (!session || !profile || !snap) return <div className="flex flex-col gap-4"><Skeleton className="h-40" /><Skeleton className="h-32" /><Skeleton className="h-64" /></div>;
  return <ProfileView name={session.name} profile={profile} snap={snap} />;
}

function ProfileView({ name, profile, snap }: { name: string; profile: Profile; snap: Snapshot }) {
  const { toast } = useShell();
  const router = useRouter();
  const nameRef = useRef<HTMLInputElement>(null);
  const stats = profileStats(snap);
  const online = repo.mode === "supabase";

  async function onPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      await repo.updateProfile({ avatar: await resizeImage(file) });
      toast("Foto atualizada");
    } catch (err) { toast(errMsg(err)); }
  }

  async function removePhoto() {
    const before = profile.avatar;
    try {
      await repo.updateProfile({ avatar: null });
      toast("Foto removida", { label: "Desfazer", run: () => void repo.updateProfile({ avatar: before }) });
    } catch (err) { toast(errMsg(err)); }
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <section className="relative overflow-hidden rounded-lg border border-border bg-surface-raised shadow-card">
        <div aria-hidden className="h-16 bg-accent-soft sm:h-20" />
        <div className="flex flex-col gap-4 px-4 pb-5 sm:flex-row sm:items-end sm:px-6">
          <div className="relative -mt-12 size-24 shrink-0 sm:-mt-14 sm:size-28">
            {profile.avatar
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={profile.avatar} alt={`Foto de ${name}`} className="size-full rounded-full border-4 border-surface-raised object-cover" />
              : <span className="grid size-full place-items-center rounded-full border-4 border-surface-raised bg-accent text-2xl font-semibold text-on-accent">{initials(name)}</span>}
            <label htmlFor="pf-photo" title="Trocar foto"
              className="absolute bottom-0 right-0 grid size-9 cursor-pointer place-items-center rounded-full border-2 border-surface-raised bg-accent text-on-accent hover:bg-accent-hover">
              <Camera aria-hidden className="size-4" /><span className="sr-only">Trocar foto</span>
            </label>
            <input id="pf-photo" type="file" accept="image/*" className="sr-only" onChange={(e) => void onPhoto(e)} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-bold">{name}</h1>
            <p className="flex items-center gap-1.5 text-sm text-text-muted">
              <Mail aria-hidden className="size-4 shrink-0" /><span className="truncate">{profile.email ?? "Dados guardados neste aparelho"}</span>
            </p>
            {profile.avatar && <button type="button" onClick={() => void removePhoto()} className="mt-1 text-xs font-semibold text-text-muted hover:text-danger">Remover foto</button>}
          </div>
          <Button variant="secondary" size="sm" className="self-start sm:absolute sm:right-4 sm:top-4"
            onClick={() => { nameRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); nameRef.current?.focus({ preventScroll: true }); }}>
            <User aria-hidden className="size-4" />Editar Perfil
          </Button>
        </div>
      </section>

      <Card>
        <SectionTitle icon={CreditCard}>Plano</SectionTitle>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Uso pessoal, sem cobrança</p>
            <p className="text-xs text-text-muted">Todos os recursos liberados</p>
          </div>
          <span className="rounded-pill bg-income px-2.5 py-0.5 text-xs font-semibold text-white">Ativo</span>
        </div>
      </Card>

      <Card>
        <SectionTitle icon={TrendingUp}>Estatísticas</SectionTitle>
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {([
            [DollarSign, String(stats.transactions), "Total de transações", "bg-accent-soft text-accent"],
            [Target, String(stats.goalsDone), "Metas concluídas", "bg-income/10 text-income"],
            [TrendingUp, formatBRL(stats.avgMonthlyCents), "Saldo médio mensal", "bg-chart-2/10 text-chart-2"],
            [CalendarDays, memberSinceLabel(profile.memberSince), "Membro desde", "bg-surface text-text-muted"],
          ] as const).map(([Icon, value, label, tone]) => (
            <li key={label} className="flex flex-col gap-2 rounded-md border border-border bg-surface p-3">
              <span className={`grid size-8 place-items-center rounded-full ${tone}`}><Icon aria-hidden className="size-4" /></span>
              <span className="whitespace-nowrap text-lg font-bold">{value}</span>
              <span className="text-xs text-text-muted">{label}</span>
            </li>
          ))}
        </ul>
      </Card>

      <PersonalInfo name={name} profile={profile} nameRef={nameRef} />
      <WhatsappSection name={name} profile={profile} snap={snap} />
      {online ? <PasswordSection hasPassword={profile.hasPassword} /> : (
        <Card>
          <SectionTitle icon={KeyRound}>Segurança</SectionTitle>
          <p className="text-sm text-text-muted">Neste modo os dados ficam só neste aparelho e não há senha. Com a conta online, você pode criar uma senha aqui.</p>
        </Card>
      )}
      <VersionSection />

      <DangerZone onLeave={() => router.replace("/entrar")} />
    </div>
  );
}

function PersonalInfo({ name, profile, nameRef }: { name: string; profile: Profile; nameRef: React.RefObject<HTMLInputElement | null> }) {
  const { toast } = useShell();
  const [fullName, setFullName] = useState(name);
  const [phone, setPhone] = useState(profile.phone);
  const [location, setLocation] = useState(profile.location);
  const [error, setError] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const dirty = fullName.trim() !== name || phone !== profile.phone || location.trim() !== profile.location;

  async function save(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!fullName.trim()) errs.name = "Informe seu nome.";
    const digits = phone.replace(/\D/g, "");
    if (digits && digits.length < 10) errs.phone = "Telefone incompleto. Use DDD + número.";
    setError(errs);
    if (Object.values(errs).some(Boolean)) return;
    setSaving(true);
    try {
      if (fullName.trim() !== name) await repo.renameSelf(fullName.trim());
      if (phone !== profile.phone || location.trim() !== profile.location) await repo.updateProfile({ phone, location: location.trim() });
      setLocation(location.trim());
      toast("Perfil atualizado");
    } catch (err) { setError({ form: errMsg(err) }); } finally { setSaving(false); }
  }

  return (
    <Card>
      <SectionTitle icon={User}>Informações Pessoais</SectionTitle>
      <form onSubmit={save} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <IconLabel icon={User} htmlFor="pf-name">Nome Completo</IconLabel>
          <Input id="pf-name" ref={nameRef} maxLength={80} autoComplete="name" value={fullName} aria-invalid={!!error.name || undefined}
            onChange={(e) => { setFullName(e.target.value); setError((x) => ({ ...x, name: "" })); }} />
          {error.name && <p className="text-xs text-danger">{error.name}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <IconLabel icon={Phone} htmlFor="pf-phone">Telefone</IconLabel>
          <Input id="pf-phone" type="tel" inputMode="tel" autoComplete="tel-national" placeholder="(00) 00000-0000" value={phone}
            aria-invalid={!!error.phone || undefined} onChange={(e) => { setPhone(maskPhone(e.target.value)); setError((x) => ({ ...x, phone: "" })); }} />
          {error.phone && <p className="text-xs text-danger">{error.phone}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <IconLabel icon={MapPin} htmlFor="pf-location">Localização</IconLabel>
          <Input id="pf-location" maxLength={80} autoComplete="address-level2" placeholder="Cidade, Estado" value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <IconLabel icon={Mail} htmlFor="pf-email">E-mail (não pode ser alterado)</IconLabel>
          <Input id="pf-email" readOnly disabled value={profile.email ?? "Sem email neste modo"} className="bg-surface text-text-muted" />
        </div>
        {error.form && <p role="alert" className="text-sm text-danger">{error.form}</p>}
        {dirty && (
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => { setFullName(name); setPhone(profile.phone); setLocation(profile.location); setError({}); }}>Cancelar</Button>
            <Button type="submit" loading={saving}>Salvar alterações</Button>
          </div>
        )}
      </form>
    </Card>
  );
}

function WhatsappSection({ name, profile, snap }: { name: string; profile: Profile; snap: Snapshot }) {
  const { toast } = useShell();
  const [adding, setAdding] = useState(false);
  const list = profile.whatsapp;

  async function save(next: typeof list, msg: string, undo?: typeof list) {
    try {
      await repo.updateProfile({ whatsapp: next });
      toast(msg, undo ? { label: "Desfazer", run: () => void repo.updateProfile({ whatsapp: undo }) } : undefined);
    } catch (err) { toast(errMsg(err)); }
  }

  return (
    <Card>
      <SectionTitle icon={MessageCircle}>Integração WhatsApp</SectionTitle>
      <p className="mb-4 text-sm text-text-muted">
        Cadastre até {MAX_WHATSAPP} números de WhatsApp (o seu e o de até 4 pessoas). Eles aparecem como sugestão ao enviar lembretes pelo WhatsApp.
        Lançar receitas e despesas por mensagem chega numa próxima etapa.
      </p>
      {list.length > 0 && (
        <ul className="mb-3 flex flex-col gap-2">
          {list.map((w) => (
            <li key={w.phone} className="flex items-center gap-3 rounded-md bg-surface px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-x-2 text-sm font-medium">
                  <span className="truncate">{w.name}</span>
                  {w.primary && <span className="flex items-center gap-0.5 text-xs font-semibold text-accent"><Star aria-hidden className="size-3 fill-current" />Principal</span>}
                </p>
                <p className="text-xs text-text-muted">{formatWhatsapp(w.phone)}</p>
              </div>
              {!w.primary && (
                <button type="button" title="Tornar principal" aria-label={`Tornar ${w.name} principal`} onClick={() => void save(setPrimaryWhatsapp(list, w.phone), "Número principal alterado")}
                  className="grid size-8 place-items-center rounded-md text-text-muted hover:bg-bg hover:text-accent"><Star aria-hidden className="size-4" /></button>
              )}
              <button type="button" title="Remover" aria-label={`Remover número de ${w.name}`} onClick={() => void save(removeWhatsapp(list, w.phone), "Número removido", list)}
                className="grid size-8 place-items-center rounded-md text-danger hover:bg-danger-soft"><Trash2 aria-hidden className="size-4" /></button>
            </li>
          ))}
        </ul>
      )}
      <Button variant="secondary" size="sm" disabled={list.length >= MAX_WHATSAPP} onClick={() => setAdding(true)}>
        <Plus aria-hidden className="size-4" />Adicionar número
      </Button>
      {list.length >= MAX_WHATSAPP && <p className="mt-2 text-xs text-text-muted">Limite de {MAX_WHATSAPP} números atingido.</p>}
      {adding && <AddWhatsappModal selfName={name} list={list} snap={snap} onClose={() => setAdding(false)}
        onSave={(next) => save(next, "Número adicionado")} />}
    </Card>
  );
}

function AddWhatsappModal({ selfName, list, snap, onClose, onSave }: {
  selfName: string; list: Profile["whatsapp"]; snap: Snapshot; onClose: () => void; onSave: (next: Profile["whatsapp"]) => Promise<void>;
}) {
  const used = new Set(list.map((w) => w.personId ?? "self"));
  const options = [{ id: "self", name: `${selfName} (você)` }, ...snap.people.filter((p) => !p.archived).map((p) => ({ id: p.id, name: p.name }))]
    .filter((o) => !used.has(o.id));
  const [who, setWho] = useState(options[0]?.id ?? "");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!who) return setError("Todas as pessoas já têm número.");
    const n = normalizeWhatsapp(phone);
    if (!n) return setError("Número inválido. Use DDD + número, ex: (11) 99999-9999.");
    const person = snap.people.find((p) => p.id === who);
    const next = addWhatsapp(list, { name: person?.name ?? selfName, personId: person ? person.id : null, phone: n });
    if (typeof next === "string") return setError(next);
    setSaving(true);
    await onSave(next);
    setSaving(false);
    onClose();
  }

  return (
    <Dialog onClose={onClose} title={<h2 className="text-lg font-semibold">Adicionar número</h2>}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Field label="De quem é o número" htmlFor="wa-who">
          <select id="wa-who" className={inputClass} value={who} onChange={(e) => setWho(e.target.value)} disabled={!options.length}>
            {options.length ? options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>) : <option value="">Todas as pessoas já têm número</option>}
          </select>
        </Field>
        <Field label="WhatsApp" htmlFor="wa-phone" error={error} hint="Com DDD. Números de fora do Brasil, comece com + e o código do país.">
          <Input id="wa-phone" type="tel" inputMode="tel" autoFocus placeholder="(11) 99999-9999" value={phone} aria-invalid={!!error || undefined}
            onChange={(e) => { setPhone(e.target.value); setError(""); }} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={saving}>Adicionar</Button>
        </div>
      </form>
    </Dialog>
  );
}

function PasswordInput({ id, label, placeholder, value, onChange, error, autoComplete }: {
  id: string; label: string; placeholder: string; value: string; onChange: (v: string) => void; error?: string; autoComplete: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">{label}</label>
      <div className="relative">
        <Input id={id} type={show ? "text" : "password"} autoComplete={autoComplete} placeholder={placeholder} value={value} className="pr-11"
          aria-invalid={!!error || undefined} onChange={(e) => onChange(e.target.value)} />
        <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Esconder senha" : "Mostrar senha"} aria-pressed={show}
          className="absolute inset-y-0 right-0 grid w-11 place-items-center text-text-muted hover:text-text">
          {show ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
        </button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

function PasswordSection({ hasPassword }: { hasPassword: boolean }) {
  const { toast } = useShell();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<PasswordCheck & { form?: string }>({});
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs = checkPassword(hasPassword, current, next, confirm);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      await repo.changePassword(hasPassword ? current : null, next);
      setCurrent(""); setNext(""); setConfirm("");
      toast(hasPassword ? "Senha alterada" : "Senha criada. Agora você também pode entrar com email e senha.");
    } catch (err) { setErrors({ form: errMsg(err) }); } finally { setSaving(false); }
  }

  return (
    <Card>
      <SectionTitle icon={KeyRound}>Segurança</SectionTitle>
      {!hasPassword && <p className="mb-4 text-sm text-text-muted">Hoje você entra pelo link enviado ao seu email. Crie uma senha para também poder entrar com email e senha.</p>}
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        {hasPassword && <PasswordInput id="pw-current" label="Senha Atual" placeholder="Digite sua senha atual" value={current} autoComplete="current-password"
          onChange={(v) => { setCurrent(v); setErrors((x) => ({ ...x, current: undefined })); }} error={errors.current} />}
        <PasswordInput id="pw-new" label="Nova Senha" placeholder="Digite sua nova senha" value={next} autoComplete="new-password"
          onChange={(v) => { setNext(v); setErrors((x) => ({ ...x, next: undefined })); }} error={errors.next} />
        <PasswordInput id="pw-confirm" label="Confirmar Nova Senha" placeholder="Confirme sua nova senha" value={confirm} autoComplete="new-password"
          onChange={(v) => { setConfirm(v); setErrors((x) => ({ ...x, confirm: undefined })); }} error={errors.confirm} />
        {errors.form && <p role="alert" className="text-sm text-danger">{errors.form}</p>}
        <Button type="submit" size="lg" loading={saving} className="w-full"><KeyRound aria-hidden className="size-4" />{hasPassword ? "Alterar Senha" : "Criar Senha"}</Button>
      </form>
    </Card>
  );
}

function VersionSection() {
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setBusy(true);
    try {
      const regs = (await navigator.serviceWorker?.getRegistrations?.()) ?? [];
      await Promise.all(regs.map((r) => r.unregister()));
      if ("caches" in window) await Promise.all((await caches.keys()).map((k) => caches.delete(k)));
    } catch { /* recarrega mesmo assim */ }
    window.location.reload();
  }

  return (
    <Card>
      <SectionTitle icon={Smartphone}>Versão do App</SectionTitle>
      <div className="mb-3 flex items-center justify-between rounded-md bg-surface px-3 py-2.5">
        <div>
          <p className="text-sm font-medium">Versão Atual</p>
          <p className="text-xs text-text-muted">Build {BUILD}</p>
        </div>
        <span className="font-bold text-accent">{VERSION}</span>
      </div>
      <Button variant="secondary" className="w-full" loading={busy} onClick={() => void refresh()}><RefreshCw aria-hidden className="size-4" />Limpar Cache e Atualizar</Button>
      <p className="mt-3 text-center text-xs text-text-muted">Use este botão se encontrar problemas de cache ou se o app não estiver atualizando corretamente.</p>
    </Card>
  );
}

function DangerZone({ onLeave }: { onLeave: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    try { await repo.deleteAccount(); onLeave(); }
    catch (err) { setError(errMsg(err)); setBusy(false); }
  }

  const outline = "inline-flex h-10 items-center gap-2 rounded-md border border-danger px-4 text-sm font-semibold text-danger hover:bg-danger-soft";
  return (
    <div className="flex flex-wrap gap-3 pb-4">
      <button type="button" className={outline} onClick={async () => { await repo.signOut(); onLeave(); }}><LogOut aria-hidden className="size-4" />Sair da Conta</button>
      <button type="button" className={outline} onClick={() => { setError(""); setConfirming(true); }}><Trash2 aria-hidden className="size-4" />Excluir Minha Conta</button>
      {confirming && (
        <Dialog onClose={() => setConfirming(false)} title={<h2 className="text-xl font-semibold">Excluir sua conta?</h2>}>
          <div className="flex flex-col gap-4 text-base text-text-muted">
            <p>
              {repo.mode === "supabase"
                ? "Ao confirmar, sua conta e todos os seus dados no Sobra serão apagados permanentemente: transações, contas bancárias, cartões, metas, investimentos, dívidas, pessoas e números de WhatsApp vinculados, veículos, lembretes e lista de desejos."
                : "Ao confirmar, todos os seus dados guardados neste aparelho serão apagados permanentemente: transações, contas bancárias, cartões, metas, investimentos, dívidas, pessoas e números de WhatsApp vinculados, veículos, lembretes e lista de desejos."}
            </p>
            <p className="font-semibold text-danger">Essa ação não pode ser desfeita.</p>
            <p>O Sobra não tem assinatura nem cobrança, então não há nada para cancelar.</p>
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" size="lg" onClick={() => setConfirming(false)}>Cancelar</Button>
              <Button type="button" variant="danger" size="lg" loading={busy} onClick={() => void remove()}>Excluir Minha Conta</Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
