"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Public sign-up. The server always creates a regular USER that stays
// UNREGISTERED until an admin activates it.

const empty = {
  name: "",
  email: "",
  department: "",
  role: "",
  password: "",
  confirmPassword: "",
};

export function SignupForm() {
  const router = useRouter();
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.email.includes("gmail.com")) return toast.error("Use your company Gmail address");
    if (form.password.length < 8) return toast.error("Password must be at least 8 characters long");
    if (form.password !== form.confirmPassword) return toast.error("Passwords do not match");

    setSaving(true);
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) return toast.error(json?.error ?? "Failed to create account");
      setDone(true);
      setForm(empty);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-lg border border-border bg-neutral-50 p-5">
        <p className="text-sm font-semibold">Account created</p>
        <p className="mt-1 text-sm text-muted-foreground">
          The IT Group will activate your account. You can sign in once it is
          approved.
        </p>
        <Button className="mt-4 w-full" onClick={() => router.push("/auth/login")}>
          Go to sign in
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field id="name" label="Full name" placeholder="Juan Dela Cruz" value={form.name} onChange={set("name")} />
      <div className="grid grid-cols-2 gap-3">
        <Field id="department" label="Department" placeholder="Marketing" value={form.department} onChange={set("department")} />
        <Field id="role" label="Position" placeholder="Account Executive" value={form.role} onChange={set("role")} />
      </div>
      <Field id="email" label="Email address" type="email" placeholder="you@gmail.com" value={form.email} onChange={set("email")} />
      <Field id="password" label="Password" type="password" placeholder="At least 8 characters" value={form.password} onChange={set("password")} />
      <Field id="confirm" label="Confirm password" type="password" placeholder="Repeat password" value={form.confirmPassword} onChange={set("confirmPassword")} />
      <Button type="submit" disabled={saving} className="mt-1 h-10 w-full">
        {saving ? "Creating account..." : "Create account"}
      </Button>
    </form>
  );
}

function Field({
  id,
  label,
  ...input
}: { id: string; label: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <Input id={id} required className="h-10" {...input} />
    </div>
  );
}
