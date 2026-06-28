"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { 
  Award, 
  Users, 
  ShieldCheck, 
  Building, 
  HelpCircle,
  TrendingUp,
  Heart,
  Loader2,
  AlertOctagon
} from "lucide-react";

export default function LeaderboardPage() {
  const { profile } = useAuth();
  const [topCitizens, setTopCitizens] = useState<any[]>([]);
  const [issues, setIssues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadLeaderboardData() {
      try {
        // 1. Fetch top citizens sorted by points
        const usersRef = collection(db, "users");
        const usersSnap = await getDocs(usersRef);
        const usersList: any[] = [];
        
        usersSnap.forEach((doc) => {
          usersList.push(doc.data());
        });
        
        // Sort and limit
        usersList.sort((a, b) => (b.points || 0) - (a.points || 0));
        setTopCitizens(usersList.slice(0, 5));

        // 2. Fetch all issues for department stats
        const issuesSnap = await getDocs(collection(db, "issues"));
        const list: any[] = [];
        issuesSnap.forEach((doc) => {
          list.push(doc.data());
        });
        setIssues(list);

      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadLeaderboardData();
  }, []);

  if (loading) {
    return (
      <div className="w-full min-h-[70vh] flex flex-col items-center justify-center gap-2 text-cyan-400">
        <Loader2 className="w-8 h-8 animate-spin" />
        <span className="text-xs uppercase tracking-widest font-semibold font-heading animate-pulse">Assembling Accountability Ledger...</span>
      </div>
    );
  }

  // Calculate Shadow Govt: Department performance statistics
  const departments = [
    { id: "pothole", name: "Road Works & PWD", manager: "Superintending Engineer" },
    { id: "drain", name: "Drainage & Sewerage Board", manager: "Chief Sanitation Officer" },
    { id: "light", name: "Lighting & Electricity Dept", manager: "Assistant General Manager" },
    { id: "water", name: "Hydraulics & Water Supply", manager: "Executive Engineer" },
    { id: "garbage", name: "Solid Waste Management", manager: "Deputy Commissioner" },
    { id: "construction", name: "Urban Encroachment Office", manager: "Zonal Officer" }
  ];

  const deptStats = departments.map((dept) => {
    const deptIssues = issues.filter((i) => i.category === dept.id);
    const assigned = deptIssues.length;
    const resolved = deptIssues.filter((i) => i.status === "Resolved").length;
    const active = assigned - resolved;
    
    // Resolution rate
    const rate = assigned > 0 ? Math.round((resolved / assigned) * 100) : 0;
    
    // Average resolution time (mocked based on data or standard)
    const avgDays = assigned > 0 ? (resolved > 0 ? 3 : 5) : 0;

    return {
      ...dept,
      assigned,
      resolved,
      active,
      rate,
      avgDays
    };
  }).sort((a, b) => b.rate - a.rate); // Sort by highest resolution rate

  // Ward vs Ward stats calculations
  const wardPerformance: Record<string, { total: number; resolved: number }> = {};
  issues.forEach((i) => {
    const ward = i.ward || "General Ward";
    if (!wardPerformance[ward]) {
      wardPerformance[ward] = { total: 0, resolved: 0 };
    }
    wardPerformance[ward].total++;
    if (i.status === "Resolved") {
      wardPerformance[ward].resolved++;
    }
  });

  const wardComparison = Object.entries(wardPerformance).map(([name, stats]) => {
    const rate = stats.total > 0 ? Math.round((stats.resolved / stats.total) * 100) : 0;
    return { name, ...stats, rate };
  }).sort((a, b) => b.rate - a.rate);

  // Global Impact Statistics
  const totalReportsFiled = issues.length;
  const totalResolved = issues.filter((i) => i.status === "Resolved").length;
  const accidentsPreventedEst = Math.round(totalResolved * 1.8);
  const totalImpactResidents = Math.round(issues.reduce((sum, i) => sum + (i.affectedPopulation || 0), 0));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-white select-none pb-10">
      
      {/* Brand Header */}
      <div className="col-span-12">
        <h2 className="text-2xl font-bold tracking-wide font-heading text-cyan-400 flex items-center gap-2">
          <Award className="w-6 h-6 animate-pulse" /> CIVIC IMPACT & ACCOUNTABILITY LEDGER
        </h2>
        <p className="text-xs text-gray-400">Public accountability score board, top citizens leaderboard, and Shadow Government performance metrics</p>
      </div>

      {/* 1. Global Metrics Summary */}
      <div className="col-span-12 grid grid-cols-2 md:grid-cols-4 gap-4">
        
        <div className="glass-card rounded-xl p-4 border border-white/5 flex items-center gap-3">
          <Building className="w-8 h-8 text-cyan-400 shrink-0" />
          <div>
            <span className="text-[10px] text-gray-500 uppercase font-semibold">Total Reports</span>
            <span className="block text-xl font-extrabold font-heading text-white">{totalReportsFiled} filed</span>
          </div>
        </div>

        <div className="glass-card rounded-xl p-4 border border-white/5 flex items-center gap-3">
          <ShieldCheck className="w-8 h-8 text-green-400 shrink-0" />
          <div>
            <span className="text-[10px] text-gray-500 uppercase font-semibold">Resolved Issues</span>
            <span className="block text-xl font-extrabold font-heading text-green-400">{totalResolved} fixed</span>
          </div>
        </div>

        <div className="glass-card rounded-xl p-4 border border-white/5 flex items-center gap-3">
          <TrendingUp className="w-8 h-8 text-cyan-400 shrink-0" />
          <div>
            <span className="text-[10px] text-gray-500 uppercase font-semibold">Accidents Prevented</span>
            <span className="block text-xl font-extrabold font-heading text-white">~{accidentsPreventedEst} est.</span>
          </div>
        </div>

        <div className="glass-card rounded-xl p-4 border border-white/5 flex items-center gap-3">
          <Heart className="w-8 h-8 text-red-400 shrink-0" />
          <div>
            <span className="text-[10px] text-gray-500 uppercase font-semibold">Residents Assisted</span>
            <span className="block text-xl font-extrabold font-heading text-white">{totalImpactResidents}+</span>
          </div>
        </div>

      </div>

      {/* 2. Left Column: Shadow Government Department performance */}
      <div className="col-span-12 lg:col-span-7 flex flex-col gap-6">
        
        {/* Shadow Govt leaderboard */}
        <div className="glass-card rounded-xl p-5 border border-white/5 flex flex-col gap-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
            <Building className="w-4 h-4" /> Shadow Govt Dept Leaderboard
          </h3>
          
          <div className="flex flex-col gap-4">
            {deptStats.map((dept) => (
              <div key={dept.id} className="p-4 bg-white/5 border border-white/5 rounded-lg flex flex-col md:flex-row justify-between md:items-center gap-4 hover:bg-white/10 transition-colors">
                <div className="flex-1">
                  <span className="font-bold text-white block text-sm capitalize">{dept.name}</span>
                  <span className="text-[9px] text-gray-500 uppercase font-bold tracking-wider mt-0.5">Manager: {dept.manager}</span>
                  
                  {/* Progress bar */}
                  <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden mt-3 max-w-sm">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        dept.rate >= 80 ? "bg-green-500" : dept.rate >= 50 ? "bg-yellow-500" : "bg-red-500"
                      }`}
                      style={{ width: `${dept.rate}%` }}
                    />
                  </div>
                </div>

                <div className="flex gap-6 text-center shrink-0">
                  <div>
                    <span className={`block font-extrabold font-heading text-lg ${
                      dept.rate >= 80 ? "text-green-400" : dept.rate >= 50 ? "text-yellow-400" : "text-red-400"
                    }`}>{dept.rate}%</span>
                    <span className="text-[9px] text-gray-500 uppercase tracking-widest">Res. Rate</span>
                  </div>
                  <div>
                    <span className="block font-extrabold font-heading text-lg text-white">{dept.assigned}</span>
                    <span className="text-[9px] text-gray-500 uppercase tracking-widest">Assigned</span>
                  </div>
                  <div>
                    <span className="block font-extrabold font-heading text-lg text-white">~{dept.avgDays}d</span>
                    <span className="text-[9px] text-gray-500 uppercase tracking-widest">Avg Days</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* 3. Right Column: Citizens Leaderboard & Ward vs Ward */}
      <div className="col-span-12 lg:col-span-5 flex flex-col gap-6">
        
        {/* Citizen Leaderboard */}
        <div className="glass-card rounded-xl p-5 border border-white/5 flex flex-col gap-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
            <Users className="w-4 h-4" /> Top Citizens Leaderboard
          </h3>

          <div className="flex flex-col gap-3">
            {topCitizens.map((citizen, idx) => (
              <div key={citizen.uid} className="p-3 bg-white/5 border border-white/5 rounded-lg flex items-center justify-between text-xs hover:bg-white/10 transition-colors">
                <div className="flex items-center gap-3">
                  <span className={`font-heading font-extrabold text-base w-5 text-center ${
                    idx === 0 ? "text-yellow-400" : idx === 1 ? "text-gray-300" : idx === 2 ? "text-orange-400" : "text-gray-600"
                  }`}>
                    {idx + 1}
                  </span>
                  <div>
                    <span className="font-bold text-white block capitalize">{citizen.name}</span>
                    <span className="text-[9px] text-gray-500 uppercase font-bold tracking-wider block mt-0.5">Role: {citizen.role}</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="font-bold font-heading text-cyan-400 block">{citizen.points || 0}</span>
                  <span className="text-[9px] text-gray-500 uppercase tracking-widest">Points</span>
                </div>
              </div>
            ))}
            {topCitizens.length === 0 && (
              <div className="text-center text-xs text-gray-500 py-6 italic">
                No active citizens registered.
              </div>
            )}
          </div>
        </div>

        {/* Ward vs Ward Comparison */}
        <div className="glass-card rounded-xl p-5 border border-white/5 flex flex-col gap-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4" /> Ward vs Ward Performance
          </h3>

          <div className="flex flex-col gap-3">
            {wardComparison.map((ward) => (
              <div key={ward.name} className="p-3 bg-white/5 border border-white/5 rounded-lg flex justify-between items-center text-xs">
                <div>
                  <span className="font-bold text-white block capitalize">{ward.name}</span>
                  <span className="text-[10px] text-gray-500">Total reported: {ward.total} issues</span>
                </div>
                <div className="text-right">
                  <span className={`font-bold font-heading text-sm block ${
                    ward.rate >= 80 ? "text-green-400" : ward.rate >= 50 ? "text-yellow-400" : "text-red-400"
                  }`}>{ward.rate}%</span>
                  <span className="text-[9px] text-gray-500 uppercase tracking-widest">Res. Rate</span>
                </div>
              </div>
            ))}
            {wardComparison.length === 0 && (
              <div className="text-center text-xs text-gray-500 py-6 italic">
                No ward data logged yet.
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
