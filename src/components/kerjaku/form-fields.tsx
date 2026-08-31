import type { ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  htmlFor?: string | undefined;
  hint?: string | undefined;
  error?: string | undefined;
  children: ReactNode;
  className?: string | undefined;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-xs tracking-wide text-muted-foreground uppercase">
        {label}
      </Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function TextField({
  label,
  name,
  hint,
  error,
  className,
  ...props
}: React.ComponentProps<typeof Input> & { label: string; hint?: string; error?: string }) {
  return (
    <Field label={label} htmlFor={name} hint={hint} error={error} className={className}>
      <Input id={name} name={name} className="bg-surface/60" {...props} />
    </Field>
  );
}

export function TextAreaField({
  label,
  name,
  hint,
  error,
  className,
  ...props
}: React.ComponentProps<typeof Textarea> & { label: string; hint?: string; error?: string }) {
  return (
    <Field label={label} htmlFor={name} hint={hint} error={error} className={className}>
      <Textarea id={name} name={name} className="min-h-24 bg-surface/60" {...props} />
    </Field>
  );
}

export function SelectField({
  label,
  value,
  onValueChange,
  options,
  placeholder = "Select…",
  hint,
  className,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  hint?: string | undefined;
  className?: string | undefined;
}) {
  return (
    <Field label={label} hint={hint} className={className}>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="w-full bg-surface/60">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

export function FileField({
  label,
  hint,
  file,
  onFileChange,
  accept = "image/*",
}: {
  label: string;
  hint?: string | undefined;
  file: File | null;
  onFileChange: (file: File | null) => void;
  accept?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-dashed border-border bg-surface/40 px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground">
        <span className="truncate">{file ? file.name : "Choose an image…"}</span>
        <span className="rounded-md bg-primary/20 px-2 py-1 text-xs text-primary-glow">Browse</span>
        <input
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
        />
      </label>
    </Field>
  );
}
