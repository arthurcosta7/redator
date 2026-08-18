"use client";

import { useState, type InputHTMLAttributes, type ReactNode } from "react";
import type { FieldError, UseFormRegisterReturn } from "react-hook-form";
import { Eye, EyeOff } from "lucide-react";

import { cn } from "@/lib/utils";

export function registrationInputClassName(hasError = false) {
  return cn(
    "min-h-12 w-full border bg-transparent px-4 text-base text-ink outline-none transition-[border-color,box-shadow] placeholder:text-ink-muted/60",
    hasError
      ? "border-red-400 focus:border-red-600 focus:ring-2 focus:ring-red-100"
      : "border-ink-line focus:border-accent focus:ring-2 focus:ring-accent/10",
  );
}

export function RegistrationField({
  children,
  error,
  id,
  label,
  optional = false,
}: {
  children: ReactNode;
  error?: FieldError;
  id: string;
  label: string;
  optional?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-semibold text-ink-soft">
        {label}{" "}
        {optional && <span className="font-normal text-ink-muted">(opcional)</span>}
      </label>
      {children}
      {error && <p id={`${id}-error`} className="mt-2 text-sm text-red-700">{error.message}</p>}
    </div>
  );
}

export function RegistrationPasswordField({
  autoComplete,
  error,
  id,
  label,
  registration,
}: {
  autoComplete: InputHTMLAttributes<HTMLInputElement>["autoComplete"];
  error?: FieldError;
  id: string;
  label: string;
  registration: UseFormRegisterReturn;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <RegistrationField error={error} id={id} label={label}>
      <div className="relative">
        <input
          {...registration}
          id={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          placeholder="Digite sua senha"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn(registrationInputClassName(Boolean(error)), "pr-14")}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="absolute right-1 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center text-ink-muted transition-colors hover:text-ink"
          aria-label={visible ? `Ocultar ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`}
          aria-pressed={visible}
        >
          {visible ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
        </button>
      </div>
    </RegistrationField>
  );
}
