"use client";

import { createContext, useContext, type CSSProperties, type ReactNode } from "react";
import { AtSign, BadgeCheck, CalendarCheck, Clock, CreditCard, ExternalLink, Gem, Heart, MapPin, MessageCircle, ShieldCheck, Sparkles, Star, ThumbsUp, Wrench, type LucideIcon } from "lucide-react";
import { instagramUrl, mapsUrl, safeUrl, templateOf, whatsappUrl, type BioData } from "@/lib/bio";

const BADGE_ICONS: LucideIcon[] = [CalendarCheck, Gem, CreditCard, Heart, ShieldCheck, Clock, Wrench, ThumbsUp, Star, Sparkles];

/** Escolhe um ícone pelo texto do diferencial (cai no da posição quando nada combina). */
function badgeIcon(text: string, i: number): LucideIcon {
  const t = text.toLowerCase();
  if (/agend|hor[aá]rio/.test(t)) return CalendarCheck;
  if (/pagamento|cart[aã]o|pix/.test(t)) return CreditCard;
  if (/garant|segur|certific/.test(t)) return ShieldCheck;
  if (/r[aá]pid|24h|pontual|espera|entrega/.test(t)) return Clock;
  if (/qualidade|exclusiv|fresc/.test(t)) return Gem;
  if (/material|instala|profission|experien|especializ/.test(t)) return Wrench;
  if (/personaliz|cuidado|higiene/.test(t)) return Heart;
  if (/aprovad|satisfa|cliente/.test(t)) return ThumbsUp;
  return BADGE_ICONS[i % BADGE_ICONS.length];
}

const EditCtx = createContext<((field: string) => void) | null>(null);

/** No editor, o clique no texto ou na imagem leva ao campo correspondente (os links não saem da tela). */
function Editable({ field, children, className = "" }: { field: string; children: ReactNode; className?: string }) {
  const onEdit = useContext(EditCtx);
  return onEdit
    ? <span role="button" tabIndex={-1} data-edit={field} onClick={(e) => { e.preventDefault(); onEdit(field); }}
      className={`cursor-text rounded-sm outline-offset-2 hover:outline hover:outline-1 hover:outline-[var(--bio)] ${className}`}>{children}</span>
    : <span className={className}>{children}</span>;
}

const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";

/**
 * A página do Link Bio no modelo escolhido. `edit` deixa clicar no texto/imagem para ir ao campo
 * correspondente no editor (data-edit = id do campo).
 */
export function BioView({ data, edit, onEdit }: { data: BioData; edit?: boolean; onEdit?: (field: string) => void }) {
  const t = templateOf(data.template);
  const wa = whatsappUrl(data.whatsapp);
  const ig = instagramUrl(data.instagram);
  const style = { "--bio": data.color } as CSSProperties;
  const dark = t.dark;
  const fg = dark ? "text-white" : "text-neutral-900";
  const muted = dark ? "text-white/60" : "text-neutral-500";
  const panel = dark ? "bg-white/5 border-white/10" : "bg-neutral-50 border-neutral-200";
  const font = t.serif ? "font-serif" : "";
  const href = (u: string | null) => (edit ? undefined : u ?? undefined);

  const logo = (
    <Editable field="bio-logo" className="block shrink-0">
      <span className={`grid size-20 place-items-center overflow-hidden rounded-pill border-2 ${dark ? "border-white/20 bg-neutral-800" : "border-white bg-white"} text-xl font-bold shadow-card ${font}`}
        style={{ color: data.color }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {data.logo ? <img src={data.logo} alt="" className="size-full object-cover" /> : initials(data.name)}
      </span>
    </Editable>
  );
  const title = (
    <div className="min-w-0">
      <h1 className={`flex items-center gap-1 text-xl font-bold leading-tight ${font}`}>
        <Editable field="bio-name">{data.name || "Nome da empresa"}</Editable>
        <BadgeCheck aria-label="Empresa verificada" className="size-4 shrink-0" style={{ color: data.color }} />
      </h1>
      <p className="text-sm font-semibold uppercase tracking-wide" style={{ color: data.color }}><Editable field="bio-tagline">{data.tagline || "Categoria"}</Editable></p>
      {data.city && <p className={`mt-0.5 flex items-center gap-1 text-xs ${muted}`}><MapPin aria-hidden className="size-3" /><Editable field="bio-city">{data.city}</Editable></p>}
    </div>
  );
  const cta = (
    <a href={href(wa)} target="_blank" rel="noopener noreferrer" aria-disabled={!wa || undefined}
      className="flex h-12 w-full items-center justify-center gap-2 rounded-pill px-4 text-sm font-semibold text-white shadow-card aria-disabled:opacity-60"
      style={{ background: data.color }}>
      <MessageCircle aria-hidden className="size-4" /><Editable field="bio-cta">{data.cta || "Chamar no WhatsApp"}</Editable>
    </a>
  );

  return (
    <EditCtx.Provider value={edit ? (onEdit ?? (() => {})) : null}>
    <div style={style} className={`min-h-full w-full ${dark ? "bg-neutral-950" : "bg-white"} ${fg}`}>
      {/* Topo */}
      {t.header === "cover" && (
        <Editable field="bio-cover" className="block">
          <div className="relative h-40 w-full overflow-hidden" style={{ background: `linear-gradient(135deg, ${data.color}, ${dark ? "#0a0a0a" : "#f5f5f5"})` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {data.cover && <img src={data.cover} alt="" className="size-full object-cover" />}
            <div className={`absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t ${dark ? "from-neutral-950" : "from-white"}`} />
          </div>
        </Editable>
      )}
      {t.header === "band" ? (
        <div className="flex flex-col gap-4 px-5 pb-6 pt-8 text-white" style={{ background: dark ? "#111" : `linear-gradient(135deg, ${data.color}, #1a1a1a)` }}>
          <div className="flex items-center gap-3">{logo}<div className="[&_*]:!text-white">{title}</div></div>
          {cta}
        </div>
      ) : (
        <div className={`flex items-center gap-3 px-5 ${t.header === "cover" ? "-mt-10 relative" : "pt-8"}`}>{logo}{title}</div>
      )}

      <div className="flex flex-col gap-6 px-5 py-6">
        {/* Diferenciais */}
        {data.highlights.some(Boolean) && (t.badges === "cards" ? (
          <section>
            <h2 className={`mb-2 text-sm font-bold ${font}`}>Diferenciais</h2>
            <div className="grid grid-cols-2 gap-2">
              {data.highlights.filter(Boolean).map((h, i) => {
                const Icon = badgeIcon(h, i);
                return (
                  <div key={i} className={`flex flex-col items-center gap-2 rounded-lg border p-3 text-center text-xs font-semibold ${panel}`}>
                    <Icon aria-hidden className="size-5" style={{ color: data.color }} /><Editable field={`bio-hl-${i}`}>{h}</Editable>
                  </div>
                );
              })}
            </div>
          </section>
        ) : (
          <section className={`grid grid-cols-4 gap-1 rounded-lg border p-3 ${panel}`}>
            {data.highlights.filter(Boolean).map((h, i) => {
              const Icon = badgeIcon(h, i);
              return (
                <div key={i} className="flex flex-col items-center gap-1.5 text-center text-[11px] leading-tight">
                  <Icon aria-hidden className="size-5" style={{ color: data.color }} /><Editable field={`bio-hl-${i}`}>{h}</Editable>
                </div>
              );
            })}
          </section>
        ))}

        {t.header !== "band" && cta}

        {/* Serviços / produtos */}
        {data.services.length > 0 && (
          <section>
            <h2 className={`mb-3 text-base font-bold ${font}`}><Editable field="bio-services-title">{data.servicesTitle || "Serviços"}</Editable></h2>
            {t.items === "list" ? (
              <ul className={`divide-y rounded-lg border ${panel} ${dark ? "divide-white/10" : "divide-neutral-200"}`}>
                {data.services.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span aria-hidden className="size-2 shrink-0 rounded-pill" style={{ background: data.color }} />
                      <Editable field={`bio-svc-${s.id}`} className="truncate">{s.name}</Editable>
                    </span>
                    {s.price && <span className="shrink-0 font-semibold" style={{ color: data.color }}>{s.price}</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <ul className={`grid gap-3 ${t.items === "tiles" ? "grid-cols-3" : "grid-cols-3 sm:grid-cols-4"}`}>
                {data.services.map((s) => (
                  <li key={s.id} className="flex flex-col items-center gap-1.5 text-center">
                    <span className={`grid size-16 place-items-center text-lg font-bold text-white shadow-card ${t.items === "tiles" ? "rounded-md" : "rounded-pill"} ${font}`}
                      style={{ background: `linear-gradient(135deg, ${data.color}, ${dark ? "#262626" : "#525252"})` }}>{initials(s.name)}</span>
                    <Editable field={`bio-svc-${s.id}`} className="text-xs leading-tight">{s.name}</Editable>
                    {s.price && <span className="text-xs font-semibold" style={{ color: data.color }}>{s.price}</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* Links */}
        {(data.links.length > 0 || ig || data.address) && (
          <section className="flex flex-col gap-2">
            {data.links.map((l) => (
              <a key={l.id} href={href(safeUrl(l.url))} target="_blank" rel="noopener noreferrer"
                className={`flex h-12 items-center justify-between gap-2 rounded-lg border px-4 text-sm font-semibold ${panel}`}>
                <Editable field={`bio-link-${l.id}`} className="truncate">{l.label}</Editable><ExternalLink aria-hidden className="size-4 shrink-0" style={{ color: data.color }} />
              </a>
            ))}
            {ig && (
              <a href={href(ig)} target="_blank" rel="noopener noreferrer" className={`flex h-12 items-center gap-2 rounded-lg border px-4 text-sm font-semibold ${panel}`}>
                <AtSign aria-hidden className="size-4" style={{ color: data.color }} /><Editable field="bio-instagram">Instagram</Editable>
              </a>
            )}
            {data.address && (
              <a href={href(mapsUrl(data.address))} target="_blank" rel="noopener noreferrer" className={`flex min-h-12 items-center gap-2 rounded-lg border px-4 py-2 text-sm ${panel}`}>
                <MapPin aria-hidden className="size-4 shrink-0" style={{ color: data.color }} /><Editable field="bio-address">{data.address}</Editable>
              </a>
            )}
          </section>
        )}
        <p className={`pt-2 text-center text-[11px] ${muted}`}>Feito com Sobra</p>
      </div>
    </div>
    </EditCtx.Provider>
  );
}

/** Miniatura da página (mesma tela, reduzida) para os cartões de modelo. */
export function BioThumb({ data, height = 220 }: { data: BioData; height?: number }) {
  const scale = 0.5;
  return (
    <div aria-hidden className="pointer-events-none relative w-full overflow-hidden rounded-md border border-border" style={{ height }}>
      <div className="absolute left-1/2 top-0 w-[390px] origin-top" style={{ transform: `translateX(-50%) scale(${scale})` }}>
        <BioView data={data} />
      </div>
    </div>
  );
}
