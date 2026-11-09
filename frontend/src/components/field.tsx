import type { ReactNode } from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** Form row with label, optional hint and inline error text. */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && <span className="ml-0.5 text-earth">*</span>}
      </Label>
      {children}
      {error ? (
        <p className="text-[12px] text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-[12px] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

/** Numbered section heading mirroring "A. PARTICULARS OF THE APPLICANT". */
export function FormSection({
  letter,
  title,
  description,
  children,
  className,
}: {
  letter?: string;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("grid gap-x-10 gap-y-4 py-7 first:pt-0 lg:grid-cols-[220px_1fr]", className)}>
      <div>
        <div className="flex items-center gap-2">
          {letter && (
            <span className="flex size-5 items-center justify-center rounded bg-forest-700 font-mono text-[11px] font-medium text-white">
              {letter}
            </span>
          )}
          <h2 className="text-[13.5px] font-semibold">{title}</h2>
        </div>
        {description && <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      <div className="grid gap-4">{children}</div>
    </section>
  );
}

