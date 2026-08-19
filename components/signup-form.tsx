"use client";

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { navigate } from "next/dist/client/components/segment-cache/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function SignupForm({ ...props }: React.ComponentProps<typeof Card>) {

  const [form, setForm] = useState({
    name: "",
    email: "",
    department: "",
    role: "",
    systemRole: "USER",
    password: "",
    status: "",
    confirmPassword: "",
  });
  const router = useRouter();

  const handleCreateUser = async () => {
    // Validation
    if (!form.name.trim()) {
      toast.error("Please enter a name");
      return;
    }
    if (!form.email.trim()) {
      toast.error("Please enter an email address");
      return;
    }
    if (!form.email.includes("@")) {
      toast.error("Invalid email address");
      return;
    }
    if (!form.email.includes("gmail.com")) {
      toast.error("Invalid email address");
      return;
    }
    if (!form.department.trim()) {
      toast.error("Please enter a department");
      return;
    }
    if (!form.role.trim()) {
      toast.error("Please enter a role");
      return;
    }
    if (!form.password.trim()) {
      toast.error("Please enter a password");
      return;
    }
    if (form.password.length < 8) {
      toast.error("Password must be at least 8 characters long");
      return;
    }
    if (!form.confirmPassword.trim()) {
      toast.error("Please confirm your password");
      return;
    }
    if (form.password !== form.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    const loadingToast = toast.loading("Creating your account...");

    try {
      const res = await fetch("/api/users/user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          role: form.role.toLowerCase(),
          status: "UNREGISTERED",
        }),
      });

      const data = await res.json();

      // delay AFTER response (for UX)
      await new Promise((r) => setTimeout(r, 1500));

      toast.dismiss(loadingToast);

      if (!res.ok) {
        toast.error("Failed to create account");
        console.log("Error: ", data?.error);
        return;
      }

      toast.success(`Account created successfully. Redirecting to login...`);

      setForm({
        name: "",
        department: "",
        role: "",
        email: "",
        password: "",
        systemRole: "USER",
        status: "",
        confirmPassword: "",
      });

      setTimeout(() => {
        router.push("/auth/login");
      }, 1500);

    } catch (err) {
      await new Promise((r) => setTimeout(r, 1500));
      toast.dismiss(loadingToast);
      toast.error("Something went wrong");
      console.log("error", err);
    }
  };
    
  return (
    <Card className="rounded-3xl border border-slate-200 bg-white shadow-xl" {...props}>
      <CardHeader className="p-8 pb-6">
        <CardTitle className="text-3xl font-extrabold tracking-tight text-slate-900">
          Create an account
        </CardTitle>
        <CardDescription className="text-sm text-slate-500 mt-2">
          Enter your information to get started with FixIT
        </CardDescription>
      </CardHeader>
      <CardContent className="p-8 pt-0">
        <FieldGroup className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field>
              <FieldLabel htmlFor="name" className="text-sm font-semibold text-slate-700">
                Full name
              </FieldLabel>
              <Input
                placeholder="Jane Smith"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="h-11 rounded-xl border-slate-200 bg-white shadow-sm focus-visible:border-red-500 focus-visible:ring-2 focus-visible:ring-red-500/20"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="role" className="text-sm font-semibold text-slate-700">
                Role
              </FieldLabel>
              <Input
                placeholder="Software Engineer"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="h-11 rounded-xl border-slate-200 bg-white shadow-sm focus-visible:border-red-500 focus-visible:ring-2 focus-visible:ring-red-500/20"
              />
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="department" className="text-sm font-semibold text-slate-700">
              Department
            </FieldLabel>
            <Input
              placeholder="Engineering"
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
              className="h-11 rounded-xl border-slate-200 bg-white shadow-sm focus-visible:border-red-500 focus-visible:ring-2 focus-visible:ring-red-500/20"
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="email" className="text-sm font-semibold text-slate-700">
              Email address
            </FieldLabel>
            <Input
              placeholder="you@company.com"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="h-11 rounded-xl border-slate-200 bg-white shadow-sm focus-visible:border-red-500 focus-visible:ring-2 focus-visible:ring-red-500/20"
            />
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field>
              <FieldLabel htmlFor="password" className="text-sm font-semibold text-slate-700">
                Password
              </FieldLabel>
              <Input
                placeholder="••••••••"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="h-11 rounded-xl border-slate-200 bg-white shadow-sm focus-visible:border-red-500 focus-visible:ring-2 focus-visible:ring-red-500/20"
              />
              <FieldDescription className="text-xs text-slate-500 mt-1.5">
                Must be at least 8 characters long
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="confirm-password" className="text-sm font-semibold text-slate-700">
                Confirm password
              </FieldLabel>
              <Input
                placeholder="••••••••"
                type="password"
                value={form.confirmPassword}
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                className="h-11 rounded-xl border-slate-200 bg-white shadow-sm focus-visible:border-red-500 focus-visible:ring-2 focus-visible:ring-red-500/20"
              />
            </Field>
          </div>

          <Field className="pt-2">
            <Button 
              onClick={handleCreateUser} 
              className="w-full h-11 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold shadow-md transition-all"
            >
              Create account
            </Button>
            <FieldDescription className="text-center mt-4 text-sm text-slate-500">
              Already have an account?{" "}
              <a 
                href="/auth/login" 
                className="font-semibold text-slate-900 hover:text-red-600 transition-colors"
              >
                Sign in
              </a>
            </FieldDescription>
          </Field>
        </FieldGroup>
      </CardContent>
    </Card>
  )
}
