"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

// Password input with a show/hide toggle.
export function PasswordField({
  id,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="pr-10"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

// Four-bar strength meter: length, mixed case, digit, symbol.
export function PasswordStrength({ value }: { value: string }) {
  if (!value) return null;
  const score =
    (value.length >= 8 ? 1 : 0) +
    (/[a-z]/.test(value) && /[A-Z]/.test(value) ? 1 : 0) +
    (/\d/.test(value) ? 1 : 0) +
    (/[^A-Za-z0-9]/.test(value) ? 1 : 0);
  const label = ["Too weak", "Weak", "Fair", "Good", "Strong"][score];
  const color = ["bg-red-500", "bg-red-500", "bg-amber-500", "bg-emerald-500", "bg-emerald-600"][score];

  return (
    <div className="flex items-center gap-3">
      <div className="grid flex-1 grid-cols-4 gap-1">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={cn("h-1 rounded-full", i < score ? color : "bg-neutral-200")} />
        ))}
      </div>
      <span className="w-16 text-right text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

// Live checklist of password rules, ticked as the user types.
export function PasswordChecklist({ value, confirm }: { value: string; confirm: string }) {
  const rules: [string, boolean][] = [
    ["At least 8 characters", value.length >= 8],
    ["Upper and lower case letters", /[a-z]/.test(value) && /[A-Z]/.test(value)],
    ["At least one number", /\d/.test(value)],
    ["At least one symbol", /[^A-Za-z0-9]/.test(value)],
    ["Both new passwords match", !!value && value === confirm],
  ];
  return (
    <ul className="flex flex-col gap-2">
      {rules.map(([label, ok]) => (
        <li key={label} className="flex items-center gap-2 text-xs">
          <span
            className={cn(
              "flex h-4 w-4 items-center justify-center rounded-full border",
              ok ? "border-emerald-500 bg-emerald-500 text-white" : "border-neutral-300 text-transparent",
            )}
          >
            <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M2.5 6.5l2.2 2.2L9.5 3.8" />
            </svg>
          </span>
          <span className={ok ? "text-foreground" : "text-muted-foreground"}>{label}</span>
        </li>
      ))}
    </ul>
  );
}
