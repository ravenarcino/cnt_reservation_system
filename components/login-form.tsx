
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

// Type for our user object in session
type SessionUser = {
  id: string;
  userId: string;
  email: string;
  name: string;
  role?: string;
  systemRole?: string;
};

export function LoginForm({
  className,
  ...props
}: any) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setIsLoading(false);

    if (result?.error) {
      toast.error("Login failed", { description: "Invalid email, password, or your account may be disabled" });
    } else {
      toast.success("Login successful!");
    }
  };

  // When session loads after login, redirect in useEffect
  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      const user = session.user as SessionUser;

      if (user.systemRole === "SUPER_ADMIN") {
        router.push("/super_admin/user-management");
      } else if (user.systemRole === "IT_ADMIN") {
        router.push("/it_admin/dashboard");
      } else if (user.systemRole === "HALL_ADMIN") {
        router.push("/hall_admin/dashboard");
      } else if (user.systemRole === "OB_ADMIN") {
        router.push("/ob_admin/dashboard");
      } else if (user.systemRole === "DRIVER") {
        router.push("/driver/dashboard");
      } else {
        // USER
        router.push("/user/dashboard");
        // or router.push("/user/dashboard"); if that's your route
      }
    }
  }, [status, session, router]);

  return (
    <form onSubmit={handleSubmit} className={cn("flex flex-col gap-5", className)} {...props}>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium">
          Email address
        </label>
        <Input
          id="email"
          type="email"
          placeholder="you@company.com"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-10"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="password" className="text-sm font-medium">
            Password
          </label>
          <Link href="/auth/forgot-password" className="text-xs font-medium text-brand hover:underline">
            Forgot password?
          </Link>
        </div>
        <Input
          id="password"
          type="password"
          placeholder="••••••••"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-10"
        />
      </div>

      <Button type="submit" disabled={isLoading} className="mt-1 h-10 w-full">
        {isLoading ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  );
}
