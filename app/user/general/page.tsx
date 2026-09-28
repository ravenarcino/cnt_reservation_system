"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PasswordChecklist, PasswordField, PasswordStrength } from "@/components/account/password-field";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";

type SessionUser = {
  id: string;
  userId: string;
  email: string;
  name: string;
  role?: string;
  systemRole?: string;
};

type UserProfile = {
  user_id: string;
  name: string;
  email: string;
  department: string;
  role: string;
  status: "REGISTERED" | "UNREGISTERED";
  systemRole: "USER" | "IT_ADMIN" | "HALL_ADMIN" | "OB_ADMIN" | "SUPER_ADMIN";
  createdAt: string;
  updatedAt: string;
};

// Capitalises the first letter of each word and leaves the rest alone, so a
// typed "it compliance officer" shows as "It Compliance Officer" while an
// acronym already written as "IT" stays "IT".
function toTitleCase(value: string) {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatEnumLabel(value: string) {
  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function GeneralPage() {
  const { data: session } = useSession();
  const user = session?.user as SessionUser | undefined;
  const queryClient = useQueryClient();

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [profileForm, setProfileForm] = useState({
    name: "",
    email: "",
    department: "",
    role: "",
  });

  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });

  const { data: profileData, isLoading: profileLoading } = useQuery({
    queryKey: ["profile", user?.userId],
    queryFn: async () => {
      const res = await fetch(`/api/users/myaccount/get`);
      const json = await res.json();

      if (!res.ok) throw new Error(json?.error);

      return json;
    },
    enabled: !!user?.userId,
  });

  // myaccount/get returns the user object directly (no `.data` wrapper).
  // Sync it into the editable form during render (React's recommended
  // pattern for "adjusting state when a prop/query value changes")
  // instead of an effect, which would cause an extra cascading render.
  const [syncedProfile, setSyncedProfile] = useState<UserProfile | null>(null);
  const profile: UserProfile | undefined = profileData;

  if (profile && profile !== syncedProfile) {
    setSyncedProfile(profile);
    setProfileForm({
      name: profile.name ?? "",
      email: profile.email ?? "",
      department: profile.department ?? "",
      role: toTitleCase(profile.role ?? ""),
    });
  }

  const handleUpdateProfile = async () => {
    if (!profileForm.name.trim()) {
      toast.error("Please enter your name");
      return;
    }

    if (!profileForm.email.trim()) {
      toast.error("Please enter your email");
      return;
    }

    if (!profileForm.department.trim()) {
      toast.error("Please enter your department");
      return;
    }

    const loadingToast = toast.loading("Updating profile...");
    setSavingProfile(true);

    try {
      const res = await fetch(`/api/users/myaccount/action`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profileForm),
      });

      const data = await res.json();

      await new Promise((r) => setTimeout(r, 1000));
      toast.dismiss(loadingToast);

      if (!res.ok) {
        toast.error(data?.error ?? "Failed to update profile");
        return;
      }

      toast.success("Profile has been updated");

      queryClient.invalidateQueries({ queryKey: ["profile"], exact: false });
    } catch (err) {
      await new Promise((r) => setTimeout(r, 1000));
      toast.dismiss(loadingToast);
      toast.error("Something went wrong");
      console.log("error", err);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!passwordForm.current_password.trim()) {
      toast.error("Please enter your current password");
      return;
    }

    if (!passwordForm.new_password.trim()) {
      toast.error("Please enter a new password");
      return;
    }

    if (passwordForm.new_password.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast.error("New password and confirmation do not match");
      return;
    }

    const loadingToast = toast.loading("Updating password...");
    setSavingPassword(true);

    try {
      const res = await fetch(`/api/users/myaccount/password`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: passwordForm.current_password,
          newPassword: passwordForm.new_password,
        }),
      });

      const data = await res.json();

      await new Promise((r) => setTimeout(r, 1000));
      toast.dismiss(loadingToast);

      if (!res.ok) {
        toast.error(data?.error ?? "Failed to update password");
        return;
      }

      toast.success("Password has been updated");
      setPasswordForm({ current_password: "", new_password: "", confirm_password: "" });
    } catch (err) {
      await new Promise((r) => setTimeout(r, 1000));
      toast.dismiss(loadingToast);
      toast.error("Something went wrong");
      console.log("error", err);
    } finally {
      setSavingPassword(false);
    }
  };

  const initials = (profile?.name ?? "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  return (
    <div className="h-full flex flex-col gap-5">
      <div>
        <h1 className="page-title">General</h1>
        <p className="text-sm text-muted-foreground text-wrap">
          Manage your account details and security
        </p>
      </div>

      {/* Profile header */}
      <Card className="max-w-3xl flex-row items-center gap-4 px-5 py-5">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-soft text-lg font-semibold text-brand">
          {profileLoading ? <Spinner /> : initials || "?"}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold">{profile?.name ?? "—"}</p>
          <p className="truncate text-sm text-muted-foreground">{profile?.email ?? ""}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {profile && (
              <>
                <span className="rounded border border-border bg-neutral-50 px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                  {formatEnumLabel(profile.systemRole)}
                </span>
                <span
                  className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                    profile.status === "REGISTERED"
                      ? "bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200"
                      : "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200"
                  }`}
                >
                  {profile.status === "REGISTERED" ? "Active" : formatEnumLabel(profile.status)}
                </span>
              </>
            )}
          </div>
        </div>
        <div className="hidden text-right sm:block">
          <p className="text-xs text-muted-foreground">Member since</p>
          <p className="text-sm font-medium">
            {profile ? new Date(profile.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" }) : "—"}
          </p>
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">{profile?.user_id}</p>
        </div>
      </Card>

      <Tabs defaultValue="profile" className="w-full max-w-3xl">
        <TabsList variant="line" className="h-auto w-full justify-start gap-6 rounded-none border-b border-border p-0">
          {[
            ["profile", "Profile"],
            ["security", "Security"],
          ].map(([value, label]) => (
            <TabsTrigger
              key={value}
              value={value}
              className="flex-none px-0 pb-3 pt-1 text-sm font-medium normal-case tracking-normal after:bg-brand group-data-horizontal/tabs:after:bottom-[-1px] data-active:text-brand"
            >
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="profile">
          <Card className="gap-0 py-0">
            <div className="border-b border-border px-5 py-4">
              <p className="text-sm font-semibold">Personal information</p>
              <p className="text-xs text-muted-foreground">This is how you appear on reservations and logs.</p>
            </div>

            <div className="p-5">
              {profileLoading ? (
                <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
                  <Spinner />
                  <span>Loading profile</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="acc-name" className="text-xs text-muted-foreground">Full name</Label>
                    <Input
                      id="acc-name"
                      value={profileForm.name}
                      onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="acc-email" className="text-xs text-muted-foreground">Email</Label>
                    <Input
                      id="acc-email"
                      type="email"
                      value={profileForm.email}
                      onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="acc-dept" className="text-xs text-muted-foreground">Department</Label>
                    <Input
                      id="acc-dept"
                      value={profileForm.department}
                      onChange={(e) => setProfileForm({ ...profileForm, department: e.target.value })}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="acc-role" className="text-xs text-muted-foreground">Position</Label>
                    <Input
                      id="acc-role"
                      value={profileForm.role}
                      onChange={(e) => setProfileForm({ ...profileForm, role: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end border-t border-border bg-neutral-50 px-5 py-3">
              <Button onClick={handleUpdateProfile} disabled={savingProfile || profileLoading}>
                {savingProfile ? "Saving..." : "Save changes"}
              </Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card className="gap-0 py-0">
            <div className="border-b border-border px-5 py-4">
              <p className="text-sm font-semibold">Password</p>
              <p className="text-xs text-muted-foreground">
                {profile
                  ? `Account last updated ${new Date(profile.updatedAt).toLocaleDateString(undefined, { dateStyle: "medium" })}.`
                  : "Change your account password."}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 p-5 md:grid-cols-[1fr_220px]">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="pw-current" className="text-xs text-muted-foreground">Current password</Label>
                  <PasswordField
                    id="pw-current"
                    value={passwordForm.current_password}
                    placeholder="Enter your current password"
                    onChange={(v) => setPasswordForm({ ...passwordForm, current_password: v })}
                  />
                </div>

                <div className="h-px bg-border" />

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="pw-new" className="text-xs text-muted-foreground">New password</Label>
                  <PasswordField
                    id="pw-new"
                    value={passwordForm.new_password}
                    placeholder="Create a new password"
                    onChange={(v) => setPasswordForm({ ...passwordForm, new_password: v })}
                  />
                  <PasswordStrength value={passwordForm.new_password} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="pw-confirm" className="text-xs text-muted-foreground">Confirm new password</Label>
                  <PasswordField
                    id="pw-confirm"
                    value={passwordForm.confirm_password}
                    placeholder="Type it again"
                    onChange={(v) => setPasswordForm({ ...passwordForm, confirm_password: v })}
                  />
                </div>
              </div>

              <div className="rounded-md border border-border bg-neutral-50 p-4 md:self-start">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Password requirements
                </p>
                <PasswordChecklist
                  value={passwordForm.new_password}
                  confirm={passwordForm.confirm_password}
                />
              </div>
            </div>

            <div className="flex justify-end border-t border-border bg-neutral-50 px-5 py-3">
              <Button
                onClick={handleUpdatePassword}
                disabled={
                  savingPassword ||
                  !passwordForm.current_password ||
                  passwordForm.new_password.length < 8 ||
                  passwordForm.new_password !== passwordForm.confirm_password
                }
              >
                {savingPassword ? "Saving..." : "Update password"}
              </Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
