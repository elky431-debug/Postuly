"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Sidebar } from "./sidebar";
import type { User } from "@supabase/supabase-js";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    async function getUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/");
        return;
      }

      setUser(user);
      setLoading(false);
    }

    getUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.push("/");
      } else {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAFAF9]">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-stone-200 border-t-[#F97316]"
          aria-hidden
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#FAFAF9]">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-7xl px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
