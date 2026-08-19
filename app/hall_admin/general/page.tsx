"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  systemRole: "USER" | "IT_ADMIN" | "HALL_ADMIN" | "SUPER_ADMIN";
  createdAt: string;
  updatedAt: string;
};

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
      role: profile.role ?? "",
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

  return (
    <div className="h-full flex flex-col gap-5">
      <div>
        <p className="text-lg font-semibold">General</p>
        <p className="text-sm text-muted-foreground text-wrap">
          Manage your account details and security
        </p>
      </div>

      <Tabs defaultValue="profile" className="w-full max-w-2xl">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>Update your personal information.</CardDescription>
            </CardHeader>

            <CardContent className="flex flex-col gap-4">
              {profileLoading ? (
                <div className="flex items-center justify-center gap-2 text-muted-foreground py-10">
                  <Spinner />
                  <span>Loading profile</span>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3 rounded-sm border p-3 bg-muted/30">
                    <div>
                      <label className="text-xs text-muted-foreground">User ID</label>
                      <p className="font-medium">{profile?.user_id ?? "—"}</p>
                    </div>

                    <div>
                      <label className="text-xs text-muted-foreground">Status</label>
                      <p className="font-medium">
                        {profile ? formatEnumLabel(profile.status) : "—"}
                      </p>
                    </div>

                    <div>
                      <label className="text-xs text-muted-foreground">System Role</label>
                      <p className="font-medium">
                        {profile ? formatEnumLabel(profile.systemRole) : "—"}
                      </p>
                    </div>

                    <div>
                      <label className="text-xs text-muted-foreground">Member Since</label>
                      <p className="font-medium">
                        {profile ? new Date(profile.createdAt).toLocaleDateString() : "—"}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <Label>Full Name</Label>
                    <Input
                      value={profileForm.name}
                      onChange={(e) =>
                        setProfileForm({ ...profileForm, name: e.target.value })
                      }
                      className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={profileForm.email}
                      onChange={(e) =>
                        setProfileForm({ ...profileForm, email: e.target.value })
                      }
                      className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <Label>Department</Label>
                    <Input
                      value={profileForm.department}
                      onChange={(e) =>
                        setProfileForm({ ...profileForm, department: e.target.value })
                      }
                      className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <Label>Role</Label>
                    <Input
                      value={profileForm.role}
                      onChange={(e) =>
                        setProfileForm({ ...profileForm, role: e.target.value })
                      }
                      className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                  </div>
                </>
              )}
            </CardContent>

            <CardFooter>
              <Button
                onClick={handleUpdateProfile}
                disabled={savingProfile || profileLoading}
                className="w-full lg:w-auto bg-green-800 rounded-sm py-5 text-white font-medium"
              >
                {savingProfile ? "Saving..." : "Save Changes"}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Security</CardTitle>
              <CardDescription>Change your account password.</CardDescription>
            </CardHeader>

            <CardContent className="flex flex-col gap-4">
              {profile && (
                <p className="text-xs text-muted-foreground">
                  Last changed:{" "}
                  {new Date(profile.updatedAt).toLocaleDateString(undefined, {
                    dateStyle: "medium",
                  })}
                </p>
              )}

              <div className="flex flex-col gap-1">
                <Label>Current Password</Label>
                <Input
                  type="password"
                  value={passwordForm.current_password}
                  onChange={(e) =>
                    setPasswordForm({ ...passwordForm, current_password: e.target.value })
                  }
                  className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                />
              </div>

              <div className="flex flex-col gap-1">
                <Label>New Password</Label>
                <Input
                  type="password"
                  value={passwordForm.new_password}
                  onChange={(e) =>
                    setPasswordForm({ ...passwordForm, new_password: e.target.value })
                  }
                  className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                />
              </div>

              <div className="flex flex-col gap-1">
                <Label>Confirm New Password</Label>
                <Input
                  type="password"
                  value={passwordForm.confirm_password}
                  onChange={(e) =>
                    setPasswordForm({ ...passwordForm, confirm_password: e.target.value })
                  }
                  className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                />
              </div>
            </CardContent>

            <CardFooter>
              <Button
                onClick={handleUpdatePassword}
                disabled={savingPassword}
                className="w-full lg:w-auto bg-green-800 rounded-sm py-5 text-white font-medium"
              >
                {savingPassword ? "Saving..." : "Update Password"}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}