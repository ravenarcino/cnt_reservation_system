
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
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
      } else {
        // USER
        router.push("/user/dashboard");
        // or router.push("/user/dashboard"); if that's your route
      }
    }
  }, [status, session, router]);

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="rounded-3xl border border-slate-200 bg-white shadow-xl">
        <CardHeader className="p-8 pb-6">
          <CardTitle className="text-3xl font-extrabold tracking-tight text-slate-900">
            Sign in to your account
          </CardTitle>
          <CardDescription className="text-sm text-slate-500 mt-2">
            Enter your credentials to access FixIT
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8 pt-0">
          <form onSubmit={handleSubmit}>
            <FieldGroup className="space-y-5">
              <Field>
                <FieldLabel htmlFor="email" className="text-sm font-semibold text-slate-700">
                  Email address
                </FieldLabel>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 rounded-xl border-slate-200 bg-white shadow-sm focus-visible:border-red-500 focus-visible:ring-2 focus-visible:ring-red-500/20"
                />
              </Field>
              <Field>
                <div className="flex items-center justify-between mb-1.5">
                  <FieldLabel htmlFor="password" className="text-sm font-semibold text-slate-700">
                    Password
                  </FieldLabel>
                  <a
                href="/auth/forgot-password"
                className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
              >
                Forgot password?
              </a>
                </div>
                <Input
                  id="password"
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 rounded-xl border-slate-200 bg-white shadow-sm focus-visible:border-red-500 focus-visible:ring-2 focus-visible:ring-red-500/20"
                />
              </Field>
              <Field className="pt-2">
                <Button 
                  type="submit" 
                  disabled={isLoading} 
                  className="w-full h-11 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold shadow-md transition-all"
                >
                  {isLoading ? "Signing in..." : "Sign in"}
                </Button>
                <FieldDescription className="text-center mt-4 text-sm text-slate-500">
                  Don&apos;t have an account?{" "}
                  <a 
                    href="/auth/signup" 
                    className="font-semibold text-slate-900 hover:text-red-600 transition-colors"
                  >
                    Create an account
                  </a>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

