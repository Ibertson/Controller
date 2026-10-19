import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";
import { Loader2, type LucideIcon } from "lucide-react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-on-accent hover:bg-accent-hover",
  secondary: "bg-surface-raised text-text border border-border hover:bg-surface",
  ghost: "bg-transparent text-text hover:bg-surface",
  danger: "bg-danger text-on-accent hover:opacity-90",
};
const sizes: Record<Size, string> = { sm: "h-8 px-3 text-xs", md: "h-10 px-4 text-sm", lg: "h-12 px-5 text-base" };

export function Button({ variant = "primary", size = "md", loading, className = "", children, disabled, ...rest }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean }) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-colors duration-[var(--duration-fast)] disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {loading && <Loader2 aria-hidden className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return <section className={`rounded-lg border border-border bg-surface-raised p-4 shadow-card ${className}`}>{children}</section>;
}

export function Field({ label, error, hint, htmlFor, children }: { label: string; error?: string; hint?: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-xs font-semibold text-text-muted">{label}</label>
      {children}
      {error ? <p id={`${htmlFor}-error`} className="text-xs text-danger">{error}</p>
        : hint ? <p id={`${htmlFor}-hint`} className="text-xs text-text-muted">{hint}</p> : null}
    </div>
  );
}

export const inputClass =
  "h-11 w-full rounded-md border border-border-input bg-bg px-3 text-base text-text placeholder:text-text-muted aria-[invalid=true]:border-danger";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className = "", ...rest }, ref) {
  return <input ref={ref} {...rest} className={`${inputClass} ${className}`} />;
});

export function Segmented<T extends string>({ label, value, options, onChange }:
  { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-1 rounded-md bg-surface p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className="h-9 rounded-sm text-sm font-semibold text-text-muted aria-checked:bg-surface-raised aria-checked:text-text aria-checked:shadow-card"
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ProgressBar({ ratio, label }: { ratio: number; label: string }) {
  const pct = Math.min(100, Math.round(ratio * 100));
  const tone = ratio > 1 ? "bg-danger" : ratio >= 0.8 ? "bg-warning" : "bg-accent";
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(ratio * 100)}
      className="mt-1.5 h-2 overflow-hidden rounded-pill bg-surface">
      <span className={`block h-full rounded-pill ${tone}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function EmptyState({ icon: Icon, title, action }: { icon: LucideIcon; title: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
      <span className="grid size-14 place-items-center rounded-pill bg-accent-soft text-accent"><Icon aria-hidden className="size-7" /></span>
      <p className="max-w-xs text-sm text-text-muted">{title}</p>
      {action}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-md bg-surface ${className}`} />;
}

export function PageTitle({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h1 className="text-lg font-semibold">{children}</h1>
      {actions}
    </div>
  );
}
