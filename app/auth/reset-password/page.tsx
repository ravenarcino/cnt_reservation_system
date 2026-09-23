"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthShell } from "@/components/auth/auth-shell";

function ResetPasswordContent() {
  const token = useSearchParams().get("token");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return toast.error("Password must be at least 8 characters long");
    if (password !== confirmPassword) return toast.error("Passwords do not match");

    setIsLoading(true);
    try {
      const res = await fetch("/api/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, confirmPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        setIsSuccess(true);
      } else {
        toast.error(data.error || "Something went wrong. Please try again.");
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = (
    <Link href="/auth/login" className="font-medium text-brand hover:underline">
      Back to sign in
    </Link>
  );

  if (!token) {
    return (
      <AuthShell title="Link not valid" footer={signIn}>
        <div className="rounded-lg border border-border bg-neutral-50 p-5 text-sm">
          This reset link is missing or has expired.{" "}
          <Link href="/auth/forgot-password" className="font-medium text-brand hover:underline">
            Request a new one
          </Link>
          .
        </div>
      </AuthShell>
    );
  }

  if (isSuccess) {
    return (
      <AuthShell title="Password updated" subtitle="You can now sign in with your new password.">
        <Button asChild className="h-10 w-full">
          <Link href="/auth/login">Sign in</Link>
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Set a new password" subtitle="Use at least 8 characters." footer={signIn}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-sm font-medium">
            New password
          </label>
          <Input id="password" type="password" required value={password}
            onChange={(e) => setPassword(e.target.value)} className="h-10" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="confirm" className="text-sm font-medium">
            Confirm password
          </label>
          <Input id="confirm" type="password" required value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)} className="h-10" />
        </div>
        <Button type="submit" disabled={isLoading} className="h-10 w-full">
          {isLoading ? "Saving..." : "Reset password"}
        </Button>
      </form>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordContent />
    </Suspense>
  );
}
