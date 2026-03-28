"use client";

import Link from "next/link";
import { Trash2 } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { SidebarNav } from "./SidebarNav";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setReady(true);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!user && pathname !== "/") {
      router.replace("/");
      return;
    }
  }, [ready, user, pathname, router]);

  if (!ready) {
    if (pathname === "/") {
      return <div className="min-h-screen">{children}</div>;
    }
    return <div className="min-h-screen" />;
  }

  if (!user) {
    return <div className="min-h-screen">{children}</div>;
  }

  if (pathname === "/") {
    return <div className="min-h-screen">{children}</div>;
  }

  return (
    <div className="flex min-h-screen bg-zinc-50 text-zinc-950">
      <aside className="fixed left-0 top-0 z-30 flex h-screen w-64 flex-col overflow-y-auto border-r border-zinc-200 bg-sky-50">
        <div className="flex h-16 shrink-0 items-center px-6">
          <Link
            href="/dashboard"
            className="text-sm font-semibold tracking-wide text-zinc-900"
          >
            Vizer
          </Link>
        </div>
        <SidebarNav />
        <div className="mt-auto shrink-0 border-t border-sky-100 px-3 py-3">
          <Link
            href="/trash"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium text-zinc-500 hover:bg-sky-100 hover:text-rose-600"
          >
            <Trash2 className="h-4 w-4 text-sky-500" />
            <span>Trash</span>
          </Link>
        </div>
      </aside>
      <main className="ml-64 flex-1 min-h-screen">
        <div className="mx-auto w-full max-w-7xl p-6 md:p-10">{children}</div>
      </main>
    </div>
  );
}
