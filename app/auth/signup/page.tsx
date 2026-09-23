import Link from "next/link";
import { SignupForm } from "@/components/signup-form";
import { AuthShell } from "@/components/auth/auth-shell";

export default function Page() {
  return (
    <AuthShell
      title="Create account"
      subtitle="For CNT employees. Your account is activated by the IT Group."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/auth/login" className="font-medium text-brand hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <SignupForm />
    </AuthShell>
  );
}
