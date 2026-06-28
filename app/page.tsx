"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

export default function Home() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) {
        if (profile) {
          if (profile.role?.trim()?.toLowerCase() === "moderator") {
            router.push("/moderator");
          } else if (profile.role?.trim()?.toLowerCase() === "citizen") {
            router.push("/dashboard");
          }
        }
      } else {
        router.push("/login");
      }
    }
  }, [user, profile, loading, router]);

  return (
    <div className="w-screen h-screen bg-[#0a0a1a] flex flex-col items-center justify-center gap-4 text-cyan-400">
      <Loader2 className="w-12 h-12 animate-spin" />
      <span className="text-xs uppercase tracking-widest font-semibold font-heading animate-pulse">Initializing Pulse Link...</span>
    </div>
  );
}
