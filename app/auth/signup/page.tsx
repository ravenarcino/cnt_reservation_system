import { SignupForm } from "@/components/signup-form"
import { Skeleton } from "@/components/ui/skeleton"
import { Shield, CheckCircle2 } from "lucide-react"
import Image from "next/image"

function SignupPageSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row w-full">
      {/* Left Section Skeleton */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-12 items-center justify-center">
        <div className="w-full max-w-lg space-y-8">
          <Skeleton className="h-12 w-48 rounded-xl" />
          <div className="space-y-3">
            <Skeleton className="h-10 w-3/4 rounded-lg" />
            <Skeleton className="h-6 w-full rounded-lg" />
            <Skeleton className="h-6 w-5/6 rounded-lg" />
          </div>
          <div className="space-y-4 mt-8">
            {[1, 2, 3].map(i => (
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
          <Skeleton className="h-[680px] w-full rounded-3xl shadow-xl" />
        </div>
      </div>
    </div>
  )
}

export default function Page() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row w-full">
      {/* Left Section - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-12 items-center justify-center relative overflow-hidden">
        {/* Decorative Background Elements */}
        <div className="absolute top-0 left-0 w-72 h-72 bg-red-500/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-72 h-72 bg-slate-700/20 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
        
        <div className="w-full max-w-lg relative z-10 space-y-8">
          {/* Logo/Brand */}
          <div className="flex items-center gap-3">
            {/* <div className="h-48 w-12 rounded-xl overflow-hidden flex items-center justify-center">
              <Image
                src="/logo-white.png"
                alt="FixIT Logo"
                width={48}
                height={48}
                className="object-cover"
              />
            </div> */}
            <span className="text-2xl font-extrabold tracking-tight text-white">FixIT</span>
          </div>

          {/* Welcome Text */}
          <div className="space-y-3">
            <h2 className="text-4xl font-extrabold tracking-tight text-white">
              Get started today
            </h2>
            <p className="text-lg text-slate-300 leading-relaxed">
              Create your FixIT account to start managing tickets, collaborating with your team, and keeping operations running smoothly.
            </p>
          </div>

          {/* Feature Highlights */}
          <div className="space-y-4 mt-8">
            <div className="flex items-start gap-3">
              <div className="mt-1 h-5 w-5 rounded-full bg-emerald-500 flex items-center justify-center">
                <CheckCircle2 className="h-3 w-3 text-white fill-current" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">
                  Easy account creation
                </h3>
                <p className="text-sm text-slate-400">
                  Sign up in minutes and get started with our intuitive interface.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="mt-1 h-5 w-5 rounded-full bg-emerald-500 flex items-center justify-center">
                <Shield className="h-3 w-3 text-white fill-current" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">
                  Enterprise-grade security
                </h3>
                <p className="text-sm text-slate-400">
                  Your data is protected with industry-standard encryption and access controls.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="mt-1 h-5 w-5 rounded-full bg-emerald-500 flex items-center justify-center">
                <CheckCircle2 className="h-3 w-3 text-white fill-current" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">
                  Instant team access
                </h3>
                <p className="text-sm text-slate-400">
                  Start collaborating with your team immediately after account creation.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Section - Signup Form */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-md">
          <SignupForm />
        </div>
      </div>
    </div>
  )
}
