"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { 
  Activity, 
  Map as MapIcon, 
  PlusSquare, 
  TrendingUp, 
  Search, 
  Award, 
  ShieldAlert,
  LogOut,
  User as UserIcon,
  Zap
} from "lucide-react";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useAuth();
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) {
          setCurrentUser(snap.data()); // fresh from Firestore
        }
      } else {
        setCurrentUser(null);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await signOut();
    router.push("/login");
  };

  const navItems = [
    { name: "Dashboard", href: "/dashboard", icon: Activity },
    { name: "Live Map", href: "/map", icon: MapIcon },
    { name: "Report Issue", href: "/report", icon: PlusSquare },
    { name: "AI Predict", href: "/predict", icon: TrendingUp },
    { name: "Street Memory", href: "/streets", icon: Search },
    { name: "Leaderboard", href: "/leaderboard", icon: Award },
  ];

  const isModerator = currentUser?.role?.trim()?.toLowerCase() === "moderator";

  return (
    <nav className="w-full sticky top-0 z-50 glass-panel border-b border-white/10 px-4 md:px-8 py-3 flex items-center justify-between text-white select-none">
      <div className="flex items-center gap-3">
        {/* Animated City Pulse Logo */}
        <div className="relative flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/20">
          <Zap className="w-5 h-5 text-white fill-white/10 animate-bounce" />
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full animate-ping" />
        </div>
        <Link href="/dashboard" className="text-xl font-bold tracking-wider font-heading bg-gradient-to-r from-white via-gray-200 to-cyan-400 bg-clip-text text-transparent">
          CIVIC<span className="text-cyan-400 font-extrabold">PULSE</span>
        </Link>
      </div>

      {/* Nav Links - Desktop */}
      <div className="hidden lg:flex items-center gap-1.5">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                isActive
                  ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shadow-inner"
                  : "text-gray-300 hover:bg-white/5 hover:text-white border border-transparent"
              }`}
            >
              <Icon className="w-4 h-4" />
              {item.name}
            </Link>
          );
        })}

        {/* Moderator Link */}
        {isModerator && (
          <Link
            href="/moderator"
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-bold transition-all duration-200 border ${
              pathname === "/moderator"
                ? "bg-red-500/20 text-red-400 border-red-500/30"
                : "text-red-400/80 hover:bg-red-500/10 border-red-500/20 hover:text-red-400"
            }`}
          >
            <ShieldAlert className="w-4.5 h-4.5 animate-pulse" />
            War Room
          </Link>
        )}
      </div>

      {/* User Stats & Session Control */}
      <div className="flex items-center gap-4">
        {currentUser && (
          <div className="hidden md:flex items-center gap-3 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 text-xs text-gray-300">
            <div className="flex items-center gap-1">
              <span className="text-cyan-400 font-bold">{currentUser.points}</span>
              <span className="text-gray-500">pts</span>
            </div>
            <div className="w-px h-3 bg-white/10" />
            <div className="flex items-center gap-1">
              <span className="text-green-400 font-bold">{currentUser.trustScore}%</span>
              <span className="text-gray-500">trust</span>
            </div>
            <div className="w-px h-3 bg-white/10" />
            <div className="flex items-center gap-1.5">
              <span className="text-gray-400 capitalize bg-white/5 px-2 py-0.5 rounded border border-white/10">{currentUser.role}</span>
            </div>
          </div>
        )}

        {currentUser ? (
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 text-xs font-bold font-heading">
              {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : <UserIcon className="w-4.5 h-4.5" />}
            </div>
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-colors cursor-pointer"
              title="Log Out"
            >
              <LogOut className="w-4.5 h-4.5" />
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            className="px-4 py-1.5 rounded-lg bg-cyan-500 text-black font-semibold text-sm hover:bg-cyan-400 transition-colors shadow-lg shadow-cyan-500/25"
          >
            Log In
          </Link>
        )}
      </div>
    </nav>
  );
}
