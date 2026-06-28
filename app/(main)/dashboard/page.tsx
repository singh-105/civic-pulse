"use client";

import { useEffect, useState } from "react";
import { collection, query, limit, orderBy, onSnapshot, doc, getDoc, updateDoc, arrayUnion } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useAuth } from "@/hooks/useAuth";
import { useGamification } from "@/hooks/useGamification";
import { Issue } from "@/types/issue";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  Award, 
  MapPin, 
  AlertTriangle, 
  Shield, 
  Plus, 
  Activity, 
  Heart, 
  ChevronRight,
  TrendingUp,
  FileText,
  Loader2,
  ThumbsUp,
  Map as MapIcon,
  X,
  User as UserIcon,
  Clock
} from "lucide-react";
import { generateDecayPredictions, ZonePrediction } from "@/lib/agents/decay-predictor";

// Haversine distance formula
const getDistanceKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// Relative time-ago helper
const timeAgo = (dateValue: any) => {
  if (!dateValue) return "just now";
  let date: Date;
  if (dateValue.toDate) {
    date = dateValue.toDate();
  } else {
    date = new Date(dateValue);
  }
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  
  let interval = Math.floor(seconds / 31536000);
  if (interval >= 1) return `${interval}y ago`;
  interval = Math.floor(seconds / 2592000);
  if (interval >= 1) return `${interval}mo ago`;
  interval = Math.floor(seconds / 86400);
  if (interval >= 1) return `${interval}d ago`;
  interval = Math.floor(seconds / 3600);
  if (interval >= 1) return `${interval}h ago`;
  interval = Math.floor(seconds / 60);
  if (interval >= 1) return `${interval}m ago`;
  return "just now";
};

// Select matching icon for category
const getCategoryIcon = (category: string) => {
  switch (category?.toLowerCase()) {
    case "pothole":
    case "construction":
      return AlertTriangle;
    case "drain":
    case "water":
      return Activity;
    case "light":
      return Shield;
    default:
      return MapPin;
  }
};

// Severity left border classes
const getSeverityBorderClass = (severity: number) => {
  if (severity >= 8) return "border-l-4 border-red-500";
  if (severity >= 5) return "border-l-4 border-orange-500";
  if (severity >= 3) return "border-l-4 border-yellow-500";
  return "border-l-4 border-green-500";
};

// Severity color code (for badges / icons)
const getSeverityBadgeClass = (severity: number) => {
  if (severity >= 8) return "text-red-400 bg-red-500/10 border border-red-500/20";
  if (severity >= 5) return "text-orange-400 bg-orange-500/10 border border-orange-500/20";
  if (severity >= 3) return "text-yellow-400 bg-yellow-500/10 border border-yellow-500/20";
  return "text-green-400 bg-green-500/10 border border-green-500/20";
};

export default function DashboardPage() {
  const router = useRouter();
  const { profile: authProfile } = useAuth();
  const [userData, setUserData] = useState<any>(null);
  const profile = userData || authProfile;
  const { addPoints } = useGamification();
  
  const [issues, setIssues] = useState<Issue[]>([]);
  const [myIssues, setMyIssues] = useState<Issue[]>([]);
  const [predictions, setPredictions] = useState<ZonePrediction[]>([]);
  const [topUsers, setTopUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [wardHealth, setWardHealth] = useState(85);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  
  const [dismissedAlerts, setDismissedAlerts] = useState<boolean>(false);

  // Role Guard
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        window.location.replace('/login')
        return
      }
      // Fresh fetch from Firestore using NEW user's uid
      const snap = await getDoc(doc(db, 'users', user.uid))
      if (!snap.exists()) {
        window.location.replace('/login')
        return
      }
      const data = snap.data()
      const role = data?.role?.trim()?.toLowerCase()
      
      // Set user data from Firestore (not from auth cache)
      setUserData(data)
      
      if (role === 'moderator') {
        window.location.replace('/moderator')
      }
    })
    return () => unsubscribe()
  }, [])

  // Geolocation trigger
  useEffect(() => {
    if (typeof window !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserCoords({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          });
        },
        (err) => {
          console.warn("Geolocation permission denied. Defaulting to Mumbai center.", err);
          setUserCoords({ lat: 19.076, lng: 72.8777 });
        }
      );
    } else {
      setUserCoords({ lat: 19.076, lng: 72.8777 });
    }
  }, []);

  // Fetch top users for leaderboard preview
  useEffect(() => {
    const q = query(collection(db, "users"), orderBy("points", "desc"), limit(3));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersList: any[] = [];
      snapshot.forEach((doc) => {
        usersList.push(doc.data());
      });
      setTopUsers(usersList);
    });
    return () => unsubscribe();
  }, []);

  // Set up live Firestore real-time listener on active issues
  useEffect(() => {
    if (!profile) return;

    const issuesRef = collection(db, "issues");
    const q = query(issuesRef, orderBy("createdAt", "desc"), limit(100));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const allIssues: Issue[] = [];
      snapshot.forEach((docSnap) => {
        allIssues.push({ id: docSnap.id, ...docSnap.data() } as Issue);
      });
      setIssues(allIssues);

      // Filter user's own issues
      const userIssues = allIssues.filter(
        (iss) => iss.reporterId === profile.uid || iss.reportedBy === profile.uid
      );
      setMyIssues(userIssues);

      // Calculate Ward Health Score
      const wardName = profile.ward || "Ward 12";
      const wardIssues = allIssues.filter(
        (iss) => (iss.ward === wardName || iss.wardNumber === wardName) && 
        iss.status?.toLowerCase() !== "resolved"
      );
      const totalSeverity = wardIssues.reduce((sum, current) => sum + current.severity, 0);
      const health = Math.max(0, Math.min(100, 100 - Math.round(totalSeverity * 1.5)));
      setWardHealth(health);

      // Fetch predictive decays
      try {
        const decayResult = await generateDecayPredictions(profile.ward || "Mumbai");
        const sortedPredictions = (decayResult.predictions || [])
          .filter((p) => p.probability >= 0.7)
          .slice(0, 2);
        setPredictions(sortedPredictions);
      } catch (err) {
        console.error("Failed to load predictive models:", err);
      }

      setLoading(false);
    }, (err) => {
      console.error("Real-time issues update failed:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile]);

  // Handle live upvote action (+5 points)
  const handleUpvoteNearby = async (issueId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!profile) return;
    try {
      const issueRef = doc(db, "issues", issueId);
      const issueSnap = await getDoc(issueRef);
      if (issueSnap.exists()) {
        const issueData = issueSnap.data();
        const upvoters = issueData.upvotedBy || [];
        if (upvoters.includes(profile.uid)) {
          alert("You have already upvoted this issue!");
          return;
        }
        
        await updateDoc(issueRef, {
          upvotes: (issueData.upvotes || 0) + 1,
          upvotedBy: arrayUnion(profile.uid)
        });
        
        await addPoints(profile.uid, 5, "Upvoted nearby issue");
      }
    } catch (err) {
      console.error("Upvote failed:", err);
    }
  };

  // Filter nearby issues based on location
  const nearbyIssues = issues
    .filter((issue) => {
      const issueLat = issue.location?.lat || issue.latitude;
      const issueLng = issue.location?.lng || issue.longitude;
      if (!issueLat || !issueLng) return false;

      const isResolved = issue.status?.toLowerCase() === "resolved";
      if (isResolved) return false;

      if (userCoords) {
        const dist = getDistanceKm(userCoords.lat, userCoords.lng, issueLat, issueLng);
        (issue as any).distanceKm = dist;
        return dist <= 5;
      }
      return true;
    })
    .slice(0, 10);

  if (loading || !profile) {
    return (
      <div className="w-full min-h-[70vh] flex flex-col items-center justify-center gap-4 text-cyan-400">
        <div className="animate-pulse space-y-4 w-full max-w-md">
          <div className="h-6 bg-white/10 rounded-lg w-3/4" />
          <div className="h-4 bg-white/10 rounded-lg w-1/2" />
          <div className="h-48 bg-white/10 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 text-slate-200 select-none pb-12">
      
      {/* Dynamic Header */}
      <div>
        <p className="text-xs uppercase tracking-widest text-slate-500">Overview</p>
        <h2 className="text-2xl font-bold tracking-wide font-heading text-white mt-1">Citizen Mission Control</h2>
      </div>

      {/* 3-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* ========================================================
            COLUMN 1: USER PROFILE & ACTIONS (width: 280px -> lg:col-span-3)
            ======================================================== */}
        <div className="lg:col-span-3 flex flex-col gap-6 w-full">
          
          {/* User Profile Card */}
          <div className="glass-card rounded-2xl p-5 border border-white/5 flex flex-col items-center text-center gap-4 relative overflow-hidden">
            {/* Background aura decoration */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />
            
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-cyan-400 to-blue-500 text-black flex items-center justify-center font-extrabold text-xl font-heading shadow-md shadow-cyan-400/20">
              {profile.name ? profile.name.charAt(0).toUpperCase() : "C"}
            </div>
            
            <div>
              <h3 className="font-bold text-white text-base leading-tight truncate max-w-[200px]">{profile.name || "Citizen"}</h3>
              <div className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                {profile.role}
              </div>
            </div>

            <div className="w-full grid grid-cols-2 gap-2 mt-2 pt-4 border-t border-white/5 text-xs">
              <div className="flex flex-col">
                <span className="text-slate-500 text-[9px] uppercase tracking-wider font-semibold">Earned Points</span>
                <strong className="text-cyan-400 font-mono text-lg mt-0.5">{profile.points}</strong>
              </div>
              <div className="flex flex-col">
                <span className="text-slate-500 text-[9px] uppercase tracking-wider font-semibold">Trust Index</span>
                <strong className="text-green-400 font-mono text-lg mt-0.5">{profile.trustScore}%</strong>
              </div>
            </div>
          </div>

          {/* Civic Impact Mini Card */}
          <div className="glass-card rounded-2xl p-5 border border-white/5 flex items-center gap-4 hover:border-cyan-500/20 transition-all">
            <div className="p-3 rounded-xl bg-gradient-to-tr from-cyan-400/10 to-blue-500/10 text-cyan-400 shrink-0">
              <Heart className="w-6 h-6 fill-cyan-400/20" />
            </div>
            <div className="flex flex-col">
              <span className="text-slate-500 text-[9px] uppercase tracking-wider font-semibold">Civic Impact</span>
              <strong className="text-white text-base font-heading mt-0.5">{profile.civicImpactScore} Assisted</strong>
              <p className="text-[9px] text-slate-500 mt-0.5 leading-tight">Residents helped by your reports</p>
            </div>
          </div>

          {/* Quick Actions Card */}
          <div className="glass-card rounded-2xl p-5 border border-white/5 flex flex-col gap-3">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Quick Actions</span>
            
            <button
              onClick={() => router.push("/report")}
              className="w-full bg-[#00d4ff] hover:bg-[#00b2d6] text-black py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Report New Issue
            </button>
            <button
              onClick={() => router.push("/map")}
              className="w-full bg-white/5 hover:bg-white/10 text-white py-2.5 rounded-xl text-xs font-bold border border-white/10 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <MapIcon className="w-4 h-4 text-cyan-400" /> View Live Map
            </button>
          </div>
        </div>

        {/* ========================================================
            COLUMN 2: NEWS / RISK BANNER & MAIN REPORTS FEED (lg:col-span-6)
            ======================================================== */}
        <div className="lg:col-span-6 flex flex-col gap-6">
          
          {/* Predictive threat banner */}
          {predictions.length > 0 && !dismissedAlerts && (
            <div className="glass-card border-red-500/20 bg-red-500/5 p-4.5 rounded-2xl flex items-start gap-3.5 text-red-200 relative">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5 animate-bounce" />
              <div className="flex-1 text-xs pr-6">
                <span className="font-bold uppercase tracking-wider text-red-500 block mb-1">Predictive Ward Risks</span>
                <div className="flex flex-col gap-1.5">
                  {predictions.map((p, idx) => (
                    <p key={idx} className="leading-snug">
                      ⚠️ <strong>{p.category} decay hazard ({Math.round(p.probability * 100)}%)</strong> predicted in <span className="underline">{p.zone}</span>. Reason: {p.reasoning}.
                    </p>
                  ))}
                </div>
              </div>
              <button 
                onClick={() => setDismissedAlerts(true)}
                className="absolute top-3.5 right-3.5 text-slate-500 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Active Nearby feed */}
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Active Nearby Reports</span>
              <span className="text-[9px] bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-widest">5km Range</span>
            </div>

            {/* List of nearby issues */}
            <div className="flex flex-col gap-4">
              {nearbyIssues.map((issue) => {
                const Icon = getCategoryIcon(issue.category);
                const borderClass = getSeverityBorderClass(issue.severity);
                const badgeClass = getSeverityBadgeClass(issue.severity);
                const distanceText = issue.distanceKm ? `${issue.distanceKm.toFixed(1)} km away` : "Nearby";
                const timeText = timeAgo(issue.createdAt);
                const hasUpvoted = issue.upvotedBy?.includes(profile.uid);

                const currentStatus = issue.status?.toLowerCase() || "reported";

                return (
                  <div 
                    key={issue.id}
                    onClick={() => router.push(`/issue/${issue.id}`)}
                    className={`glass-card rounded-2xl p-5 border border-white/5 flex flex-col gap-4 cursor-pointer hover:scale-[1.01] hover:bg-white/[0.06] transition-all ${borderClass}`}
                  >
                    {/* Header */}
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl ${badgeClass}`}>
                          <Icon className="w-4.5 h-4.5" />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold capitalize">{issue.category}</span>
                          <h4 className="text-sm font-bold text-white leading-tight mt-0.5 max-w-[280px] truncate">{issue.title}</h4>
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-end shrink-0">
                        <span className={`text-[9px] px-2 py-0.5 rounded font-extrabold uppercase ${badgeClass}`}>
                          Sev: {issue.severity}
                        </span>
                      </div>
                    </div>

                    {/* Metadata */}
                    <div className="flex flex-col gap-1 text-[11px] text-slate-400 px-1">
                      <span className="flex items-center gap-1.5 truncate">
                        <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        {issue.location?.address || issue.address || "Unknown Address"}
                      </span>
                      <span className="flex items-center gap-1.5 text-slate-500 mt-0.5">
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        {distanceText} • {timeText}
                      </span>
                    </div>

                    <div className="border-t border-white/5 my-0.5" />

                    {/* Status Pipeline Visual */}
                    <div className="flex items-center justify-between text-[10px] text-gray-500 px-1 py-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2.5 h-2.5 rounded-full ${currentStatus === "reported" || currentStatus === "verified" || currentStatus === "resolved" ? "bg-cyan-400 shadow-sm shadow-cyan-400/50" : "bg-white/10"}`} />
                        <span className={currentStatus === "reported" ? "text-cyan-400 font-bold" : ""}>Reported</span>
                      </div>
                      <div className="h-px flex-1 bg-white/10 mx-2" />
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2.5 h-2.5 rounded-full ${currentStatus === "verified" || currentStatus === "resolved" ? "bg-cyan-400 shadow-sm shadow-cyan-400/50" : "bg-white/10"}`} />
                        <span className={currentStatus === "verified" ? "text-cyan-400 font-bold" : ""}>Verified</span>
                      </div>
                      <div className="h-px flex-1 bg-white/10 mx-2" />
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2.5 h-2.5 rounded-full ${currentStatus === "resolved" ? "bg-green-400 shadow-sm shadow-green-400/50" : "bg-white/10"}`} />
                        <span className={currentStatus === "resolved" ? "text-green-400 font-bold" : ""}>Resolved</span>
                      </div>
                    </div>

                    <div className="border-t border-white/5 my-0.5" />

                    {/* Footer Row */}
                    <div className="flex justify-between items-center pt-1.5">
                      <span className="text-[10px] text-slate-500 font-bold">
                        👍 {issue.upvotes || 0} verified upvotes
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => handleUpvoteNearby(issue.id, e)}
                          disabled={hasUpvoted}
                          className={`px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                            hasUpvoted 
                              ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 cursor-default" 
                              : "bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10 hover:text-white"
                          }`}
                        >
                          <ThumbsUp className="w-3 h-3" />
                          <span>Upvote</span>
                        </button>
                        <span className="text-[10px] text-cyan-400 hover:underline flex items-center gap-0.5 font-bold">
                          View Details <ChevronRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {nearbyIssues.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center glass-card rounded-2xl border border-white/5 p-6">
                  <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                    <MapPin className="w-7 h-7 text-slate-500" />
                  </div>
                  <p className="text-slate-400 font-medium">No active issues nearby</p>
                  <p className="text-slate-600 text-xs mt-1 max-w-[240px]">
                    There are no unresolved potholes, outages, or complaint grids reported within 5km.
                  </p>
                  <button 
                    onClick={() => router.push("/report")}
                    className="mt-4 px-4 py-2 bg-cyan-400/10 text-cyan-400 rounded-xl text-xs border border-cyan-400/20 hover:bg-cyan-400/20 transition-colors"
                  >
                    Report Issue
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ========================================================
            COLUMN 3: WARD HEALTH & LEADERBOARD (width: 280px -> lg:col-span-3)
            ======================================================== */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          
          {/* Ward Health Index */}
          <div className="glass-card rounded-2xl p-5 border border-white/5 flex flex-col gap-4">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Ward Health Score</span>
            
            <div className="flex flex-col items-center justify-center py-2 relative">
              {/* Radial Score Gauge */}
              <div className="relative w-28 h-28 flex items-center justify-center rounded-full border-4 border-white/5">
                <span className={`text-3xl font-extrabold font-heading ${
                  wardHealth >= 80 ? "text-green-400" : wardHealth >= 50 ? "text-yellow-400" : "text-red-400"
                }`}>{wardHealth}</span>
                {/* Outer animated spinner ring */}
                <span className={`absolute inset-0 rounded-full border-2 border-dashed animate-spin-slow ${
                  wardHealth >= 80 ? "border-green-500/20" : wardHealth >= 50 ? "border-yellow-500/20" : "border-red-500/40 animate-ping"
                }`} />
              </div>
              <span className="text-xs text-white font-bold mt-4">
                Health Level: {wardHealth >= 80 ? "Optimized" : wardHealth >= 50 ? "Moderate Decay" : "CRITICAL RISK"}
              </span>
            </div>
            
            <p className="text-[10px] text-slate-500 leading-tight text-center px-2">
              Dynamically derived index of unresolved infrastructure faults logged within your ward.
            </p>
          </div>

          {/* Points this week */}
          <div className="glass-card rounded-2xl p-5 border border-white/5 flex flex-col gap-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Ward Activity Index</span>
            <div className="flex items-baseline gap-1 mt-1">
              <strong className="text-3xl font-bold font-heading text-white">+{profile.points > 10 ? profile.points - 10 : profile.points}</strong>
              <span className="text-[10px] text-cyan-400 font-bold uppercase">Points this week</span>
            </div>
            <p className="text-[9px] text-slate-500 mt-1 leading-snug">
              Keep submitting visual triage data to protect your neighborhood and climb the leaderboard.
            </p>
          </div>

          {/* Badges showcase */}
          <div className="glass-card rounded-2xl p-5 border border-white/5 flex flex-col gap-3">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Top Badges Earned</span>
            
            <div className="flex flex-wrap gap-2 mt-1">
              {profile.badges?.map((badge, idx) => (
                <span 
                  key={idx} 
                  className="px-2.5 py-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-[9px] text-cyan-400 font-extrabold uppercase tracking-wider flex items-center gap-1.5"
                >
                  <Shield className="w-3.5 h-3.5 fill-cyan-400/10 shrink-0" /> {badge}
                </span>
              ))}
              {(!profile.badges || profile.badges.length === 0) && (
                <span className="text-xs text-slate-500 italic">No badges unlocked yet.</span>
              )}
            </div>
          </div>

          {/* Leaderboard Preview (Top 3 users) */}
          <div className="glass-card rounded-2xl p-5 border border-white/5 flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Zonal Leaders</span>
              <Link href="/leaderboard" className="text-[10px] text-cyan-400 hover:underline font-bold">
                View All
              </Link>
            </div>

            <div className="flex flex-col gap-2.5">
              {topUsers.slice(0, 3).map((user, idx) => (
                <div key={user.uid} className="flex items-center justify-between p-2.5 bg-white/5 border border-white/5 rounded-xl text-xs hover:bg-white/10 transition-colors">
                  <div className="flex items-center gap-2.5 truncate">
                    <span className={`font-heading font-extrabold text-sm w-4 text-center shrink-0 ${
                      idx === 0 ? "text-yellow-400" : idx === 1 ? "text-slate-300" : "text-amber-500"
                    }`}>
                      {idx + 1}
                    </span>
                    <span className="font-bold text-white truncate max-w-[120px] block capitalize">{user.name || "Citizen"}</span>
                  </div>
                  <span className="font-mono font-bold text-cyan-400 shrink-0">{user.points || 0} pts</span>
                </div>
              ))}
              {topUsers.length === 0 && (
                <span className="text-xs text-slate-500 italic text-center py-2">No active leaders found.</span>
              )}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
