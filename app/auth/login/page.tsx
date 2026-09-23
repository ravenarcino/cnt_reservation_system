import Link from "next/link";
import { LoginForm } from "@/components/login-form";
import { AuthShell } from "@/components/auth/auth-shell";

export default function Page() {
  return (
    <AuthShell
      title="Sign in"
      subtitle="Welcome back. Use your CNT account to continue."
      footer={
        <>
          No account yet?{" "}
          <Link href="/auth/signup" className="font-medium text-brand hover:underline">
            Create one
          </Link>
        </>
      }
    >
      <LoginForm />
    </AuthShell>
  );
}
