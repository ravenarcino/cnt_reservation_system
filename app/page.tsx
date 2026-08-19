import { redirect } from "next/navigation";

export default function Home() {
  // redirect("/super_admin/user-management");
    redirect("/auth/login");
}
