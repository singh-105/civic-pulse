"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import Link from "next/link";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { 
  Activity, 
  Map as MapIcon, 
  Plus, 
  TrendingUp, 
  Award,
  Loader2,
  Zap,
  ShieldAlert,
  LogOut,
  User as UserIcon,
  Search
} from "lucide-react";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile, userRole, loading, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const snap = await getDoc(doc(db, 'users', user.uid))
        if (snap.exists()) {
          setCurrentUser({ uid: user.uid, ...snap.data() })
        } else {
          setCurrentUser(null)
        }
      } else {
        setCurrentUser(null)
      }
    })
    return () => unsubscribe()
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="w-screen h-screen bg-[#080818] flex flex-col items-center justify-center gap-4 text-cyan-400">
        <Loader2 className="w-12 h-12 animate-spin" />
        <span className="text-xs uppercase tracking-widest font-semibold font-heading animate-pulse">Initializing Pulse Link...</span>
      </div>
    );
  }

  if (!user) {
    return null; // redirecting
  }

  const handleLogout = async () => {
    await signOut();
    window.location.href = "/login";
  };

  const isModerator = currentUser?.role?.trim()?.toLowerCase() === "moderator" || userRole?.trim()?.toLowerCase() === "moderator";

  const desktopNavItems = [
    { label: "Dashboard", href: "/dashboard", icon: Activity },
    { label: "Live Map", href: "/map", icon: MapIcon },
    { label: "Report Issue", href: "/report", icon: Plus },
    { label: "AI Predict", href: "/predict", icon: TrendingUp },
    { label: "Street Memory", href: "/streets", icon: Search },
    { label: "Leaderboard", href: "/leaderboard", icon: Award },
  ];

  const mobileNavItems = [
    { href: "/dashboard", icon: Activity, label: "Home" },
    { href: "/map", icon: MapIcon, label: "Map" },
    { href: "/report", icon: Plus, label: "Report", isFab: true },
    { href: "/predict", icon: TrendingUp, label: "Activity" },
    { href: "/leaderboard", icon: Award, label: "Profile" },
  ];

  return (
    <div className="min-h-screen bg-[#080818] flex flex-col lg:flex-row pb-20 lg:pb-0 relative text-slate-200">
      
      {/* 1. Desktop Sidebar Navigation */}
      <aside className="hidden lg:flex flex-col w-[260px] fixed top-0 bottom-0 left-0 bg-[#0f0f23] border-r border-white/10 p-6 z-40">
        {/* Brand Logo Header */}
        <div className="flex items-center gap-3 mb-8 select-none">
          <div className="relative flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-tr from-cyan-400 to-blue-500 shadow-lg shadow-cyan-500/20 shrink-0">
            <Zap className="w-5 h-5 text-black" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full animate-ping" />
          </div>
          <Link href="/dashboard" className="text-xl font-bold tracking-wider font-heading text-white">
            CIVIC<span className="text-cyan-400 font-extrabold">PULSE</span>
          </Link>
        </div>

        {/* Sidebar Nav links */}
        <nav className="flex-1 flex flex-col gap-1">
          {desktopNavItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className="block">
                <div className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all cursor-pointer group ${
                  isActive 
                    ? "bg-cyan-400/10 text-cyan-400 border-l-2 border-cyan-400" 
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}>
                  <Icon className={`w-5 h-5 transition-colors ${isActive ? "text-cyan-400" : "group-hover:text-cyan-400"}`} />
                  <span className="text-sm font-medium">{item.label}</span>
                </div>
              </Link>
            );
          })}

          {isModerator && (
            <Link href="/moderator" className="block">
              <div className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all cursor-pointer group ${
                pathname === "/moderator" 
                  ? "bg-red-500/10 text-red-400 border-l-2 border-red-500" 
                  : "text-red-400 hover:text-red-300 hover:bg-white/5"
              }`}>
                <ShieldAlert className={`w-5 h-5 transition-colors ${pathname === "/moderator" ? "text-red-400" : "group-hover:text-red-400"}`} />
                <span className="text-sm font-semibold">War Room</span>
              </div>
            </Link>
          )}
        </nav>

        {/* User Card & Logout */}
        <div className="border-t border-white/10 pt-4 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 flex items-center justify-center font-bold font-heading">
              {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : <UserIcon className="w-4 h-4" />}
            </div>
            <div className="flex-1 min-w-0">
              <span className="block text-sm font-bold text-white truncate">{currentUser?.name || "Citizen"}</span>
              <span className="block text-[11px] text-slate-500 capitalize">{currentUser?.role || "citizen"}</span>
            </div>
          </div>
          {currentUser && (
            <div className="grid grid-cols-2 gap-2 bg-white/5 px-3 py-2 rounded-lg text-[10px] text-slate-400 border border-white/5">
              <div>
                <span className="block text-gray-500 uppercase tracking-widest font-semibold text-[8px]">Points</span>
                <strong className="text-cyan-400 text-sm font-mono">{currentUser.points || 0}</strong>
              </div>
              <div>
                <span className="block text-gray-500 uppercase tracking-widest font-semibold text-[8px]">Trust</span>
                <strong className="text-green-400 text-sm font-mono">{currentUser.trustScore || 100}%</strong>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer text-left"
          >
            <LogOut className="w-5 h-5" />
            <span className="text-sm font-medium">Log Out</span>
          </button>
        </div>
      </aside>

      {/* 2. Main Content Area */}
      <main className="flex-1 w-full lg:ml-[260px] min-h-screen px-6 py-6 z-10 overflow-x-hidden">
        <div className="max-w-7xl mx-auto container">
          {children}
        </div>
      </main>

      {/* 3. Mobile Bottom Navigation (Visible below lg breakpoint) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-[#0f0f23]/95 backdrop-blur-md border-t border-white/10 flex items-center justify-around px-4 z-40 select-none">
        {mobileNavItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          if (item.isFab) {
            return (
              <Link key={item.href} href={item.href} className="relative z-50">
                <button className="w-14 h-14 bg-cyan-400 rounded-full flex items-center justify-center shadow-lg shadow-cyan-400/25 hover:bg-cyan-300 transition-colors -mt-6">
                  <Plus className="w-7 h-7 text-black stroke-[3]" />
                </button>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-1 transition-colors ${
                isActive ? "text-cyan-400" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-semibold">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
