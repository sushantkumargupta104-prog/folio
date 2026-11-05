import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

interface FieldProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  badge?: ReactNode;
  children: ReactNode;
}

export function Field({ id, label, hint, error, badge, children }: FieldProps) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="block text-sm font-medium text-ink">
          {label}
        </label>
        {badge}
      </div>
      <div className="[&_input]:w-full [&_select]:w-full">
        {children}
        {describedBy ? (
          <span className="sr-only" id={`${id}-desc`}>
            {describedBy}
          </span>
        ) : null}
      </div>
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-sm text-warn">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function TextInput({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`min-h-12 rounded-[10px] border border-line bg-surface px-3 text-[16px] text-ink placeholder:text-ink-muted focus:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${className}`}
      {...props}
    />
  );
}

export function SelectInput({
  className = "",
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`min-h-12 rounded-[10px] border border-line bg-surface px-3 text-[16px] text-ink focus:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}
