"use client";

import { useEffect, useState } from "react";
import { collection, doc, getDoc, updateDoc, arrayUnion, onSnapshot, query, limit, orderBy, increment, serverTimestamp } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useAuth } from "@/hooks/useAuth";
import { Issue } from "@/types/issue";
import MapView from "@/components/map/MapView";
import { useRouter } from "next/navigation";
import { 
  ShieldAlert, 
  MapPin, 
  Check, 
  Mail, 
  AlertTriangle, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ChevronRight,
  TrendingUp,
  X
} from "lucide-react";

export default function ModeratorPage() {
  const router = useRouter();
  const { profile: authProfile } = useAuth();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const profile = currentUser || authProfile;
  const [issues, setIssues] = useState<any[]>([]);
  const [pendingIssues, setPendingIssues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  
  // Escalation Modal state
  const [letterModal, setLetterModal] = useState(false)
  const [letter, setLetter] = useState('')
  const [letterLoading, setLetterLoading] = useState(false)

  // Time ticker state
  const [currentTime, setCurrentTime] = useState("");

  // Route Protection - Role Guard
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        window.location.replace('/login')
        return
      }
      const snap = await getDoc(doc(db, 'users', user.uid))
      if (!snap.exists()) {
        window.location.replace('/login') 
        return
      }
      setCurrentUser({ uid: user.uid, ...snap.data() })
      setLoading(false)
      loadIssues()
    })
    return () => unsubscribe()
  }, [])

  const loadIssues = () => {
    const q = query(
      collection(db, 'issues'),
      orderBy('createdAt', 'desc'),
      limit(50)
    )
    onSnapshot(q, (snap) => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setIssues(all)
      setPendingIssues(all.filter(i => i.status === 'reported'))
    })
  }

  const approveIssue = async (issueId: string, reportedBy: string) => {
    await updateDoc(doc(db, 'issues', issueId), {
      status: 'verified',
      verifiedBy: currentUser?.uid,
      verifiedAt: serverTimestamp()
    })
    if (reportedBy) {
      await updateDoc(doc(db, 'users', reportedBy), {
        points: increment(5),
        pointHistory: arrayUnion({
          points: 5,
          reason: 'Issue verified by moderator',
          timestamp: new Date().toISOString()
        })
      })
    }
  }

  const rejectIssue = async (issueId: string) => {
    await updateDoc(doc(db, 'issues', issueId), {
      status: 'rejected',
      rejectedBy: currentUser?.uid,
      rejectedAt: serverTimestamp()
    })
  }

  const generateLetter = async (issue: any) => {
    setLetterLoading(true)
    setLetterModal(true)
    try {
      const res = await fetch('/api/gemini/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Generate a formal official complaint letter to municipal authority.
Issue: ${issue.title}
Category: ${issue.category}
Location: ${issue.location?.address}
Severity: ${issue.severity}/10
Root Cause: ${issue.issueDNA?.rootCause}
Reported: ${issue.createdAt?.toDate?.()?.toLocaleDateString() || 'Recently'}
Community votes: ${issue.upvotes}

Write a professional formal letter from CivicPulse platform
demanding immediate action. Include issue details, impact on residents,
and deadline for resolution. Sign as "CivicPulse AI Negotiation Agent".
Plain text only, no markdown.`
        })
      })
      const data = await res.json()
      setLetter(data.text || 'Failed to generate letter')
    } catch {
      setLetter('Failed to generate letter. Try again.')
    } finally {
      setLetterLoading(false)
    }
  }

  // Time ticker effect
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  // 1. Approve / Verify Issue
  const handleVerify = async (issue: Issue, e: React.MouseEvent) => {
    e.stopPropagation();
    setActionLoading(issue.id);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const reporterId = issue.reportedBy || issue.reporterId || "";
      await approveIssue(issue.id, reporterId);
      setSuccessMsg(`Issue verified and +5 points awarded to reporter!`);
    } catch (err: any) {
      console.error("Verification error:", err);
      setErrorMsg("Verification update failed: " + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // 2. Reject / Delete Issue
  const handleReject = async (issueId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActionLoading(issueId + "_reject");
    setErrorMsg("");
    setSuccessMsg("");

    try {
      await rejectIssue(issueId);
      setSuccessMsg(`Issue rejected.`);
    } catch (err: any) {
      console.error("Rejection error:", err);
      setErrorMsg("Rejection failed: " + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // 3. Open Escalation Modal & Generate complaint letter


  // Filter queues
  const pendingQueue = pendingIssues;
  const activeQueue = issues.filter((i) => i.status?.toLowerCase() === "verified" || i.status?.toLowerCase() === "escalated");
  const resolvedQueue = issues.filter((i) => i.status?.toLowerCase() === "resolved");

  const stats = {
    pending: issues.filter(i => i.status === 'reported').length,
    active: issues.filter(i => !['resolved','rejected'].includes(i.status)).length,
    resolvedToday: issues.filter(i => {
      if (i.status !== 'resolved') return false
      const d = i.resolvedAt?.toDate?.() || new Date(i.resolvedAt)
      return d.toDateString() === new Date().toDateString()
    }).length,
    total: issues.length
  }

  // Department scores calculation
  const departments = [
    { id: "pothole", name: "BMC Roads", categoryMatch: ["pothole", "construction"] },
    { id: "water", name: "Water Board", categoryMatch: ["water"] },
    { id: "garbage", name: "Sanitation", categoryMatch: ["garbage"] },
    { id: "light", name: "Streetlights", categoryMatch: ["light"] },
    { id: "parks", name: "Parks Dept", categoryMatch: ["tree", "other"] }
  ];

  const deptPerformance = departments.map((dept) => {
    const deptIssues = issues.filter((i) => dept.categoryMatch.includes(i.category?.toLowerCase()));
    const assigned = deptIssues.length;
    const resolved = deptIssues.filter((i) => i.status?.toLowerCase() === "resolved").length;
    const rate = assigned > 0 ? Math.round((resolved / assigned) * 100) : 0;
    return { name: dept.name, assigned, resolved, rate };
  });

  const activeCrisisLocations = issues
    .filter((i) => (i.status?.toLowerCase() === "reported" || i.status?.toLowerCase() === "verified" || i.status?.toLowerCase() === "escalated") && i.location?.lat)
    .map((i) => ({ 
      lat: i.location.lat, 
      lng: i.location.lng, 
      count: 1 
    }));

  if (loading) return (
    <div className="min-h-screen bg-[#080818] flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-cyan-400 font-mono text-sm">INITIALIZING WAR ROOM...</p>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col gap-6 text-slate-200 select-none pb-12">
      
      {/* Header section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-white/10 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
            </span>
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-extrabold">🔴 LIVE &bull; {currentTime}</p>
          </div>
          <h2 className="text-2xl font-bold tracking-wide font-heading text-orange-400 flex items-center gap-2 mt-1">
            <ShieldAlert className="w-6 h-6" /> WAR ROOM: {profile?.ward || "Mumbai Central"}
          </h2>
        </div>
        <div className="flex flex-col items-end text-right">
          <span className="text-xs font-semibold text-slate-400">Moderator: <strong className="text-white">{profile?.name || "Zonal Agent"}</strong></span>
          <span className="text-[10px] text-orange-400 mt-1 uppercase tracking-wider font-extrabold bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded">
            Unresolved Issues: {issues.filter(i => i.status?.toLowerCase() !== "resolved" && i.status?.toLowerCase() !== "rejected").length}
          </span>
        </div>
      </div>

      {/* Success/Error Alerts */}
      {(successMsg || errorMsg) && (
        <div className="animate-fade-in">
          {successMsg && (
            <div className="bg-green-500/10 border border-green-500/20 text-green-400 text-xs px-4 py-3 rounded-xl font-bold">
              ✓ {successMsg}
            </div>
          )}
          {errorMsg && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-4 py-3 rounded-xl font-bold">
              ⚠️ {errorMsg}
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          1. STAT CARDS ROW
          ======================================================== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Pending */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1 font-bold">PENDING APPROVAL</p>
          <p className="text-3xl font-bold text-yellow-400 font-mono">{stats.pending}</p>
          <p className="text-[9px] text-yellow-400/80 mt-1.5 flex items-center gap-1">
            ⚠️ Requires manual verification
          </p>
        </div>

        {/* Active Issues */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1 font-bold">ACTIVE ISSUES</p>
          <p className="text-3xl font-bold text-red-400 font-mono">{stats.active}</p>
          <p className="text-[9px] text-red-400/80 mt-1.5 flex items-center gap-1">
            ⚡ Verified or Escalated
          </p>
        </div>

        {/* Resolved Today */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1 font-bold">RESOLVED LEAKS</p>
          <p className="text-3xl font-bold text-green-400 font-mono">{stats.resolvedToday}</p>
          <p className="text-[9px] text-green-400/80 mt-1.5 flex items-center gap-1">
            ✓ Logged resolved in ledger
          </p>
        </div>

        {/* Avg Resolution Time */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1 font-bold">AVG RESOLUTION TIME</p>
          <p className="text-3xl font-bold text-blue-400 font-mono">3.2 Days</p>
          <p className="text-[9px] text-blue-400/80 mt-1.5 flex items-center gap-1">
            ✦ Municipal response rate
          </p>
        </div>

      </div>

      {/* ========================================================
          2. MIDDLE SECTION (Queue and Map)
          ======================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT: Approval Queue (60%) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div>
            <h3 className="text-base font-bold text-white">Zonal Approval Queue ({pendingQueue.length})</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Approve, reject, or escalate reports submitted by citizens.</p>
          </div>

          <div className="flex flex-col gap-4 max-h-[550px] overflow-y-auto pr-1">
            {pendingQueue.map((item) => {
              const borderClass = item.severity >= 8 ? "border-l-4 border-red-500" : item.severity >= 5 ? "border-l-4 border-orange-500" : "border-l-4 border-yellow-500";
              const severityColor = item.severity >= 8 ? "text-red-400 bg-red-500/10 border-red-500/20" : item.severity >= 5 ? "text-orange-400 bg-orange-500/10 border-orange-500/20" : "text-yellow-400 bg-yellow-500/10 border-yellow-500/20";
              
              return (
                <div 
                  key={item.id}
                  onClick={() => router.push(`/issue/${item.id}`)}
                  className={`bg-[#0f0f23]/60 rounded-2xl p-4.5 border border-white/5 hover:bg-white/[0.05] transition-all flex flex-col gap-3.5 cursor-pointer ${borderClass}`}
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex items-center gap-3 truncate">
                      {(item.image || item.imageBase64) && (
                        <img 
                          src={item.image || item.imageBase64} 
                          alt="Fault Thumbnail" 
                          className="w-12 h-12 object-cover rounded-xl border border-white/10 shrink-0" 
                        />
                      )}
                      <div className="truncate">
                        <span className="text-[9px] text-cyan-400 uppercase tracking-widest font-extrabold block capitalize">{item.category}</span>
                        <h4 className="text-xs font-bold text-white truncate max-w-[240px] mt-0.5">{item.title}</h4>
                      </div>
                    </div>
                    <span className={`text-[9px] px-2 py-0.5 rounded font-extrabold uppercase shrink-0 border ${severityColor}`}>
                      Sev: {item.severity}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-400 line-clamp-2 px-1">
                    {item.description || "No description provided."}
                  </p>

                  <div className="flex flex-wrap items-center justify-between gap-2 px-1 border-t border-white/5 pt-2 text-[10px] text-slate-500">
                    <span className="flex items-center gap-1 truncate max-w-[250px]"><MapPin className="w-3.5 h-3.5 shrink-0" /> {item.location?.address || item.address}</span>
                    <span className="shrink-0">Reporter Trust Index: <strong className="text-green-400 font-mono">100%</strong></span>
                  </div>

                  {/* Actions buttons */}
                  <div className="flex justify-end gap-2 border-t border-white/5 pt-2.5">
                    <button
                      onClick={(e) => handleReject(item.id, e)}
                      disabled={actionLoading === item.id + "_reject"}
                      className="px-3 py-1.5 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 rounded-xl text-[10px] font-bold cursor-pointer transition-colors flex items-center gap-1 disabled:opacity-40"
                    >
                      {actionLoading === item.id + "_reject" ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                      Reject
                    </button>
                    
                    <button
                      onClick={(e) => handleVerify(item, e)}
                      disabled={actionLoading === item.id}
                      className="px-3 py-1.5 bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20 rounded-xl text-[10px] font-bold cursor-pointer transition-colors flex items-center gap-1 disabled:opacity-40"
                    >
                      {actionLoading === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      Approve
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        generateLetter(item);
                      }}
                      className="px-3 py-1 bg-orange-400/10 text-orange-400 border border-orange-400/20 rounded-lg text-xs hover:bg-orange-400/20"
                    >
                      📨 Escalate
                    </button>
                  </div>
                </div>
              );
            })}
            
            {pendingQueue.length === 0 && (
              <div className="text-center text-xs text-slate-500 py-16 border border-dashed border-white/5 rounded-2xl flex flex-col items-center justify-center p-4">
                <CheckCircle2 className="w-10 h-10 text-green-500/40 mb-2" />
                <span className="font-bold text-slate-400">All reports triaged</span>
                <p className="text-[10px] text-slate-600 mt-0.5">Zonal approval ledger is fully verified.</p>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Spatial Map (40%) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div>
            <h3 className="text-base font-bold text-white">Spatial Ward Grid</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Real-time geographical mapping of reported incidents.</p>
          </div>
          
          <div className="h-[380px] rounded-2xl overflow-hidden border border-white/10 relative z-0">
            <MapView 
              issues={issues} 
              activeCrisisLocations={activeCrisisLocations}
              showCrisisZones={true}
            />
          </div>
        </div>

      </div>

      {/* ========================================================
          3. BOTTOM SECTION: DEPARTMENT TABLE
          ======================================================== */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col gap-4">
        <div>
          <h3 className="text-base font-bold text-white">Shadow Government Performance</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">Resolution rates of municipal agencies calculated directly from community ledgers.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/10 text-slate-400 font-medium">
                <th className="py-2.5 px-4 font-bold">DEPARTMENT</th>
                <th className="py-2.5 px-4 text-center font-bold">ASSIGNED</th>
                <th className="py-2.5 px-4 text-center font-bold">RESOLVED</th>
                <th className="py-2.5 px-4 text-right font-bold">RESOLUTION RATE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {deptPerformance.map((dept, index) => (
                <tr key={index} className="hover:bg-white/[0.02]">
                  <td className="py-3 px-4 font-bold text-white">{dept.name}</td>
                  <td className="py-3 px-4 text-center font-semibold font-mono">{dept.assigned}</td>
                  <td className="py-3 px-4 text-center text-green-400 font-semibold font-mono">{dept.resolved}</td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-3 font-semibold font-mono">
                      <span className={dept.rate >= 80 ? "text-green-400" : dept.rate >= 50 ? "text-yellow-400" : "text-red-400"}>{dept.rate}%</span>
                      <div className="w-16 h-1 bg-white/5 rounded-full overflow-hidden shrink-0">
                        <div 
                          className={`h-full rounded-full ${dept.rate >= 80 ? "bg-green-500" : dept.rate >= 50 ? "bg-yellow-500" : "bg-red-500"}`}
                          style={{ width: `${dept.rate}%` }}
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {letterModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f0f23] border border-white/10 rounded-2xl w-full max-w-2xl">
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <h3 className="text-white font-semibold">AI Escalation Letter</h3>
              <button onClick={() => setLetterModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <div className="p-6">
              {letterLoading ? (
                <div className="flex items-center gap-3 text-cyan-400">
                  <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"/>
                  Generating letter...
                </div>
              ) : (
                <textarea
                  value={letter}
                  onChange={e => setLetter(e.target.value)}
                  className="w-full h-64 bg-white/5 border border-white/10 rounded-xl p-4 text-slate-300 text-sm resize-none focus:outline-none"
                />
              )}
            </div>
            <div className="flex gap-3 p-6 border-t border-white/10">
              <button
                onClick={() => navigator.clipboard.writeText(letter)}
                className="px-4 py-2 bg-white/10 text-white rounded-xl text-sm hover:bg-white/20"
              >
                Copy Letter
              </button>
              <button
                onClick={() => setLetterModal(false)}
                className="px-4 py-2 bg-cyan-400 text-black rounded-xl text-sm font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
