"use client";

import { format } from "date-fns";
import { useSession } from "next-auth/react";

// "Good morning, Allen" header shared by the admin dashboards.
export function Greeting({ caption, updatedAt }: { caption: string; updatedAt?: number }) {
  const { data: session } = useSession();
  const h = new Date().getHours();
  const part = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  const first = session?.user?.name?.split(" ")[0];
  return (
    <div>
      <h1 className="page-title">{first ? `${part}, ${first}` : part}</h1>
      <p className="text-sm text-muted-foreground text-wrap">
        {caption}
        {updatedAt ? ` · Updated ${format(new Date(updatedAt), "h:mm a")}` : ""}
      </p>
    </div>
  );
}
