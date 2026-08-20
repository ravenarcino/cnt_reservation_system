"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import Image from "next/image";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, CheckCircle2 } from "lucide-react";

function ForgotPasswordPageSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row w-full">
      {/* Left Section Skeleton */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-12 items-center justify-center">
        <div className="w-full max-w-lg space-y-8">
          <Skeleton className="h-12 w-48 rounded-xl" />
          <div className="space-y-3">
            <Skeleton className="h-10 w-3/4 rounded-lg" />
            <Skeleton className="h-6 w-full rounded-lg" />
          </div>
          <div className="space-y-4 mt-8">
            {[1, 2].map(i => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
                <div className="space-y-1 flex-1">
                  <Skeleton className="h-5 w-40 rounded-lg" />
                  <Skeleton className="h-4 w-full rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Section Skeleton */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-md">
          <Skeleton className="h-[400px] w-full rounded-3xl shadow-xl" />
        </div>
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch("/api/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        setIsSuccess(true);
        toast.success("Password reset email sent successfully!");
      } else {
        toast.error("Something went wrong. Please try again.");
      }
    } catch (error) {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row w-full">
        {/* Left Section - Branding */}
        <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-12 items-center justify-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-72 h-72 bg-red-500/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-72 h-72 bg-slate-700/20 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
          
          <div className="w-full max-w-lg relative z-10 space-y-8">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl overflow-hidden flex items-center justify-center">
                <Image
                  src="/logo.jpg"
                  alt="FixIT Logo"
                  width={48}
                  height={48}
                  className="object-cover"
                />
              </div>
              <span className="text-2xl font-extrabold tracking-tight text-white">FixIT</span>
            </div>
          </div>
        </div>

        {/* Right Section - Success Message */}
        <div className="flex-1 flex items-center justify-center p-6 md:p-12">
          <Card className="w-full max-w-md rounded-3xl border border-slate-200 bg-white shadow-xl">
            <CardHeader className="p-8 pb-6 text-center">
              <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              </div>
              <CardTitle className="text-2xl font-extrabold tracking-tight text-slate-900">
                Check your email
              </CardTitle>
              <CardDescription className="text-sm text-slate-500">
                A password reset link has been sent to <span className="font-semibold">{email}</span>.
                The link will expire in 30 minutes.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-8 pt-0 flex flex-col gap-3">
              <Button
                className="w-full h-11 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold shadow-md transition-all"
                onClick={() => router.push("/auth/login")}
              >
                Back to login
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row w-full">
      {/* Left Section - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-12 items-center justify-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-72 h-72 bg-red-500/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-72 h-72 bg-slate-700/20 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
        
        <div className="w-full max-w-lg relative z-10 space-y-8">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl overflow-hidden flex items-center justify-center">
              <Image
                src="/logo.jpg"
                alt="FixIT Logo"
                width={48}
                height={48}
                className="object-cover"
              />
            </div>
            <span className="text-2xl font-extrabold tracking-tight text-white">FixIT</span>
          </div>

          <div className="space-y-3">
            <h2 className="text-4xl font-extrabold tracking-tight text-white">
              Forgot your password?
            </h2>
            <p className="text-lg text-slate-300 leading-relaxed">
              Enter your email and we'll send you a link to reset it.
            </p>
          </div>

          <div className="space-y-4 mt-8">
            <div className="flex items-start gap-3">
              <div className="mt-1 h-5 w-5 rounded-full bg-emerald-500 flex items-center justify-center">
                <CheckCircle2 className="h-3 w-3 text-white fill-current" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">
                  Secure reset process
                </h3>
                <p className="text-sm text-slate-400">
                  Your request is encrypted and processed securely.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="mt-1 h-5 w-5 rounded-full bg-emerald-500 flex items-center justify-center">
                <Shield className="h-3 w-3 text-white fill-current" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">
                  Limited time link
                </h3>
                <p className="text-sm text-slate-400">
                  Reset links expire after 30 minutes.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Section - Forgot Password Form */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12">
        <Card className="w-full max-w-md rounded-3xl border border-slate-200 bg-white shadow-xl">
          <CardHeader className="p-8 pb-6">
            <CardTitle className="text-2xl font-extrabold tracking-tight text-slate-900">
              Reset your password
            </CardTitle>
            <CardDescription className="text-sm text-slate-500">
              Enter your email address to receive a reset link
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
                <Field className="pt-2">
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-11 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold shadow-md transition-all"
                  >
                    {isLoading ? "Sending..." : "Send reset link"}
                  </Button>
                  <FieldDescription className="text-center mt-4 text-sm text-slate-500">
                    Remember your password?{" "}
                    <a
                      href="/auth/login"
                      className="font-semibold text-slate-900 hover:text-red-600 transition-colors"
                    >
                      Back to login
                    </a>
                  </FieldDescription>
                </Field>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}