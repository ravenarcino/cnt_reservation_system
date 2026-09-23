"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthShell } from "@/components/auth/auth-shell";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await fetch("/api/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setIsSuccess(true);
      } else {
        toast.error("Something went wrong. Please try again.");
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const backToLogin = (
    <Link href="/auth/login" className="font-medium text-brand hover:underline">
      Back to sign in
    </Link>
  );

  if (isSuccess) {
    return (
      <AuthShell title="Check your email" footer={backToLogin}>
        <div className="rounded-lg border border-border bg-neutral-50 p-5 text-sm">
          <p>
            If an account exists for <span className="font-medium">{email}</span>, we sent a
            link to reset your password. The link expires after a short time.
          </p>
          <p className="mt-3 text-muted-foreground">Didn&apos;t get it? Check your spam folder or try again.</p>
          <Button variant="outline" className="mt-4 w-full" onClick={() => setIsSuccess(false)}>
            Send again
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Forgot password"
      subtitle="Enter your email and we'll send you a link to reset it."
      footer={backToLogin}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-medium">
            Email address
          </label>
          <Input
            id="email"
            type="email"
            placeholder="you@company.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-10"
          />
        </div>
        <Button type="submit" disabled={isLoading} className="h-10 w-full">
          {isLoading ? "Sending..." : "Send reset link"}
        </Button>
      </form>
    </AuthShell>
  );
}
