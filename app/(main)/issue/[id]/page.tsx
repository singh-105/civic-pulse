"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, updateDoc, arrayUnion, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { useGamification } from "@/hooks/useGamification";
import { Issue, TimelineItem, NegotiationLogItem } from "@/types/issue";
import { 
  ArrowLeft, 
  ThumbsUp, 
  UserCheck, 
  MapPin, 
  Clock, 
  Activity, 
  AlertTriangle, 
  ShieldCheck, 
  CheckCircle,
  MessageSquare,
  Sparkles,
  Camera,
  Loader2,
  TrendingDown,
  X
} from "lucide-react";

export default function IssueDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { profile } = useAuth();
  const { addPoints } = useGamification();
  const issueId = params.id as string;

  const [issue, setIssue] = useState<Issue | null>(null);
  const [streetMemory, setStreetMemory] = useState<any>(null);
  
  // Resolution controls (Moderators)
  const [afterImage, setAfterImage] = useState<string>("");
  const [resolutionComment, setResolutionComment] = useState("");
  
  const [loading, setLoading] = useState(true);

  // AI Escalation Letter states
  const [letterModal, setLetterModal] = useState(false);
  const [letter, setLetter] = useState('');
  const [letterLoading, setLetterLoading] = useState(false);

  const generateLetter = async (issue: any) => {
    setLetterLoading(true);
    setLetterModal(true);
    try {
      const res = await fetch('/api/gemini/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Generate a formal official complaint letter to municipal authority.
Issue: ${issue.title}
Category: ${issue.category}
Location: ${issue.location?.address || issue.address}
Severity: ${issue.severity}/10
Root Cause: ${issue.issueDNA?.rootCause || issue.rootCause || ''}
Reported: ${issue.createdAt?.toDate?.()?.toLocaleDateString() || 'Recently'}
Community votes: ${issue.upvotes || 0}

Write a professional formal letter from CivicPulse platform
demanding immediate action. Include issue details, impact on residents,
and deadline for resolution. Sign as "CivicPulse AI Negotiation Agent".
Plain text only, no markdown.`
        })
      });
      const data = await res.json();
      setLetter(data.text || 'Failed to generate letter');
    } catch {
      setLetter('Failed to generate letter. Try again.');
    } finally {
      setLetterLoading(false);
    }
  };
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");

  const loadIssueData = async () => {
    try {
      const issueRef = doc(db, "issues", issueId);
      const docSnap = await getDoc(issueRef);

      if (!docSnap.exists()) {
        setError("Issue not found.");
        setLoading(false);
        return;
      }

      const issueData = docSnap.data() as Issue;
      setIssue({ id: docSnap.id, ...issueData });

      // Fetch corresponding Street Memory
      if (issueData.streetName) {
        const streetRef = doc(db, "streets", issueData.streetName.trim().toLowerCase());
        const streetSnap = await getDoc(streetRef);
        if (streetSnap.exists()) {
          setStreetMemory(streetSnap.data());
        }
      }
    } catch (e) {
      console.error(e);
      setError("Failed to fetch issue details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (issueId) {
      loadIssueData();
    }
  }, [issueId]);

  // Handle Upvote / Verify
  const handleUpvote = async () => {
    if (!profile || !issue) return;
    setActionLoading(true);
    try {
      const issueRef = doc(db, "issues", issue.id);
      
      const updates: any = {
        upvotes: (issue.upvotes || 0) + 1,
        upvotedBy: arrayUnion(profile.uid)
      };

      // If user verifies, add to verifiedBy
      const isVerifying = !issue.verifiedBy?.includes(profile.uid);
      if (isVerifying) {
        updates.verifiedBy = arrayUnion(profile.uid);
      }

      await updateDoc(issueRef, updates);

      // Award Verify Points
      await addPoints(profile.uid, 5, "Upvoted nearby issue");
      
      // Reload issue
      await loadIssueData();
    } catch (e) {
      console.error(e);
      setError("Failed to upvote.");
    } finally {
      setActionLoading(false);
    }
  };

  // Convert afterImage to base64
  const handleAfterImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAfterImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Resolve issue (Moderators only)
  const handleResolveIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !issue || !afterImage) {
      setError("Please capture/upload the resolved state image.");
      return;
    }
    setActionLoading(true);
    setError("");

    try {
      const issueRef = doc(db, "issues", issue.id);
      
      const timelineItem = {
        status: "Resolved",
        updatedBy: profile.name || "Moderator",
        updatedAt: Timestamp.now(),
        comment: resolutionComment || "Issue resolved, verified with visual proof."
      };

      await updateDoc(issueRef, {
        status: "Resolved",
        afterImage: afterImage,
        resolvedAt: Timestamp.now(),
        timeline: arrayUnion(timelineItem)
      });

      // Award Points for resolving (to the original reporter)
      if (issue.reportedBy || issue.reporterId) {
        await addPoints(issue.reportedBy || issue.reporterId, 25, "Your reported issue has been resolved");
      }
      
      // Reload issue
      await loadIssueData();
      setResolutionComment("");
      setAfterImage("");
    } catch (e) {
      console.error(e);
      setError("Failed to resolve issue.");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full min-h-[70vh] flex flex-col items-center justify-center gap-2 text-cyan-400">
        <Loader2 className="w-8 h-8 animate-spin" />
        <span className="text-xs uppercase tracking-widest font-semibold font-heading animate-pulse">Accessing Secure Issue Log...</span>
      </div>
    );
  }

  if (error || !issue) {
    return (
      <div className="text-center py-20 text-white">
        <h2 className="text-xl font-bold font-heading mb-4">{error || "Issue details could not be parsed."}</h2>
        <button onClick={() => router.back()} className="px-4 py-2 bg-cyan-500 text-black text-xs font-bold rounded-lg cursor-pointer">
          Go Back
        </button>
      </div>
    );
  }

  const pipeline = ["Reported", "Verified", "Escalated", "Assigned", "Resolved"];
  const currentStepIndex = pipeline.indexOf(issue.status);

  return (
    <div className="flex flex-col gap-6 text-white pb-10">
      
      {/* Back button */}
      <div>
        <button 
          onClick={() => router.back()} 
          className="flex items-center gap-2 text-xs text-gray-400 hover:text-cyan-400 transition-colors font-bold cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> BACK TO CONSOLE
        </button>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold font-heading">{issue.title}</h1>
            <span className={`text-xs px-2.5 py-0.5 rounded font-bold uppercase tracking-wider ${
              issue.status === "Resolved" 
                ? "bg-green-500/20 text-green-400 border border-green-500/30" 
                : issue.status === "Escalated"
                ? "bg-red-500/20 text-red-400 border border-red-500/30"
                : "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
            }`}>
              {issue.status}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1 flex items-center gap-1.5 flex-wrap">
            <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0" /> {issue.address}
            <span className="text-gray-600">•</span>
            <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" /> 
            {issue.createdAt?.toDate ? issue.createdAt.toDate().toLocaleDateString() : new Date(issue.createdAt).toLocaleDateString()}
            <span className="text-gray-600">•</span>
            <span>Reporter: {issue.reporterName}</span>
          </p>
        </div>

        {/* Upvotes / Verify Control */}
        {profile && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleUpvote}
              disabled={actionLoading || issue.upvotedBy?.includes(profile.uid) || issue.status === "Resolved"}
              className={`px-4 py-2.5 rounded-lg border text-xs font-bold transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 ${
                issue.upvotedBy?.includes(profile.uid)
                  ? "bg-cyan-500/20 border-cyan-500/30 text-cyan-400"
                  : "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:border-cyan-400/40"
              }`}
            >
              <ThumbsUp className="w-4 h-4" /> 
              {issue.upvotedBy?.includes(profile.uid) ? "Verified / Voted" : "Upvote & Verify (+5 pts)"}
              <span className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] text-white ml-1">
                {issue.upvotes || 0}
              </span>
            </button>

            {/* Escalate button for Citizen */}
            <button
              onClick={() => generateLetter(issue)}
              className="px-4 py-2.5 bg-orange-400/10 text-orange-400 border border-orange-400/20 rounded-lg text-xs font-bold hover:bg-orange-400/20 transition-all cursor-pointer flex items-center gap-1.5"
            >
              📨 Escalate
            </button>
          </div>
        )}
      </div>

      {/* 1. Status Stepper Pipeline */}
      <div className="glass-card rounded-xl p-5 border border-white/5 flex flex-col gap-4">
        <span className="block text-xs font-bold text-cyan-400 uppercase tracking-wider">Status Pipeline</span>
        <div className="relative flex items-center justify-between mt-2 max-w-4xl mx-auto w-full">
          {/* Connector line */}
          <div className="absolute top-1/2 left-0 right-0 h-1 bg-white/5 -translate-y-1/2 z-0" />
          <div 
            className="absolute top-1/2 left-0 h-1 bg-gradient-to-r from-cyan-400 to-green-500 -translate-y-1/2 transition-all duration-300"
            style={{ width: `${(currentStepIndex / (pipeline.length - 1)) * 100}%` }}
          />

          {pipeline.map((step, idx) => {
            const isCompleted = idx <= currentStepIndex;
            const isCurrent = idx === currentStepIndex;
            return (
              <div key={step} className="flex flex-col items-center gap-1.5 z-10 relative">
                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
                  isCompleted 
                    ? "bg-darkBg border-cyan-400 text-cyan-400 shadow-md shadow-cyan-400/20" 
                    : "bg-darkBg border-white/10 text-gray-500"
                }`}>
                  {isCompleted ? <ShieldCheck className="w-4 h-4 fill-cyan-400/10" /> : idx + 1}
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${
                  isCurrent ? "text-cyan-400" : isCompleted ? "text-gray-300" : "text-gray-500"
                }`}>{step}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Before / After Image Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Before */}
        <div className="glass-card rounded-xl p-5 border border-white/5 flex flex-col gap-3">
          <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Before (Reported Incident State)</span>
          <div className="aspect-video w-full rounded-lg overflow-hidden border border-white/10 bg-black/40">
            <img src={issue.image} alt="Reported issue state" className="w-full h-full object-cover" />
          </div>
        </div>

        {/* After */}
        <div className="glass-card rounded-xl p-5 border border-white/5 flex flex-col gap-3">
          <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider">After (Resolved Proof State)</span>
          {issue.afterImage ? (
            <div className="aspect-video w-full rounded-lg overflow-hidden border border-white/10 bg-black/40">
              <img src={issue.afterImage} alt="Resolved issue state" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="aspect-video w-full rounded-lg border-2 border-dashed border-white/5 bg-white/5 flex flex-col items-center justify-center text-center p-4">
              <Camera className="w-8 h-8 text-gray-600 mb-2" />
              <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Resolution Proof Pending</span>
              <p className="text-[10px] text-gray-500 mt-1 max-w-[200px]">
                Once resolved, the ward moderator will upload verification photos here.
              </p>
            </div>
          )}
        </div>

      </div>

      {/* 3. Issue DNA & Street Memory */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Issue DNA */}
        <div className="glass-card rounded-xl p-5 border border-white/5 flex flex-col gap-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
            <Activity className="w-4 h-4" /> Issue DNA Diagnostic
          </h3>
          <div className="flex flex-col gap-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[10px] text-gray-500 uppercase font-semibold">Category</span>
                <span className="block text-white font-bold capitalize mt-0.5">{issue.category}</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-500 uppercase font-semibold">Subcategory</span>
                <span className="block text-white font-bold capitalize mt-0.5">{issue.subcategory || "N/A"}</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-500 uppercase font-semibold">Affected Population</span>
                <span className="block text-white font-bold mt-0.5">{issue.affectedPopulation || 10} residents</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-500 uppercase font-semibold">Severity (AI Classified)</span>
                <span className="block text-red-400 font-bold mt-0.5">{issue.severity}/10</span>
              </div>
            </div>
            <div className="pt-2.5 border-t border-white/5">
              <span className="text-[10px] text-gray-500 uppercase font-semibold">Root Cause Hypothesis (Issue DNA)</span>
              <p className="text-cyan-300 font-medium mt-1 italic">"{issue.rootCause || "Analyzing stress factors..."}"</p>
            </div>
          </div>
        </div>

        {/* Temporal Street Memory */}
        <div className="glass-card rounded-xl p-5 border border-white/5 flex flex-col gap-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
            <Clock className="w-4 h-4" /> Temporal Street Memory
          </h3>
          {streetMemory ? (
            <div className="flex flex-col gap-3 text-xs">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 flex items-center justify-center rounded-full border-2 border-cyan-500/20 text-cyan-400">
                  <span className="text-lg font-bold font-heading">{streetMemory.healthScore}</span>
                </div>
                <div>
                  <span className="text-white font-bold capitalize">{issue.streetName} Health score</span>
                  <span className="text-[10px] text-gray-400 block mt-0.5">
                    {streetMemory.totalIssues} total reports, {streetMemory.resolved} resolved
                  </span>
                </div>
              </div>
              <p className="text-gray-300 bg-white/5 p-3 rounded border border-white/5 italic text-[11px] leading-relaxed">
                "{streetMemory.insight}"
              </p>
            </div>
          ) : (
            <div className="text-center text-xs text-gray-500 py-8 italic">
              Generating street memory matrix...
            </div>
          )}
        </div>

      </div>

      {/* 4. Timeline (WhatsApp-style thread) & AI Negotiation Log */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Timeline Thread */}
        <div className="glass-card rounded-xl p-5 border border-white/5 flex flex-col gap-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
            <MessageSquare className="w-4 h-4" /> Timeline Log Thread
          </h3>
          <div className="flex flex-col gap-4 max-h-[300px] overflow-y-auto pr-1">
            {issue.timeline?.map((item: TimelineItem, idx) => (
              <div key={idx} className="flex gap-3 text-xs">
                <div className="flex flex-col items-center">
                  <div className="w-2 h-2 bg-cyan-400 rounded-full mt-1.5" />
                  {idx < (issue.timeline.length - 1) && <div className="w-px h-full bg-white/10 my-1" />}
                </div>
                <div className="flex-1 bg-white/5 border border-white/5 rounded-lg p-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-white text-[11px] uppercase tracking-wide">{item.status}</span>
                    <span className="text-[9px] text-gray-500">
                      {item.updatedAt?.toDate ? item.updatedAt.toDate().toLocaleDateString() : new Date(item.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-gray-300 text-[11px] leading-relaxed">{item.comment}</p>
                  <span className="block text-[9px] text-gray-500 mt-1.5 font-semibold">— {item.updatedBy}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AI Negotiation Agent Log */}
        <div className="glass-card rounded-xl p-5 border border-white/5 flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" /> AI Negotiation Console
            </h3>
            <span className="text-[9px] text-gray-500 uppercase font-bold tracking-wider animate-pulse">Live</span>
          </div>

          <div className="flex flex-col gap-3 flex-1 max-h-[300px] overflow-y-auto pr-1">
            {issue.negotiationLog && issue.negotiationLog.length > 0 ? (
              issue.negotiationLog.map((log: NegotiationLogItem, idx) => (
                <div key={idx} className="bg-cyan-500/5 border border-cyan-500/10 rounded-lg p-3 text-[11px] flex flex-col gap-1.5">
                  <div className="flex justify-between text-[10px] text-cyan-400/80 font-bold uppercase">
                    <span>{log.sender} Dispatch</span>
                    <span>
                      {log.timestamp?.toDate ? log.timestamp.toDate().toLocaleDateString() : new Date(log.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-gray-300 leading-relaxed italic">"{log.message}"</p>
                </div>
              ))
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border border-dashed border-white/5 rounded-lg">
                <Sparkles className="w-8 h-8 text-gray-600 mb-2 animate-pulse" />
                <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">AI Negotiator Monitoring</span>
                <p className="text-[10px] text-gray-500 mt-1 max-w-[200px]">
                  Negotiator is actively watching this issue. A formal complaint letter will be drafted and sent via Resend if unresolved after 48 hours.
                </p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* 5. Moderator Resolution Panel (Only Visible to moderators) */}
      {profile?.role?.trim()?.toLowerCase() === "moderator" && issue.status !== "Resolved" && (
        <div className="glass-card rounded-xl p-5 border border-red-500/20 bg-red-500/5 mt-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-red-400 flex items-center gap-1.5 mb-4">
            <ShieldCheck className="w-4.5 h-4.5 animate-pulse" /> Moderator Action: Resolve Redressal Request
          </h3>
          
          <form onSubmit={handleResolveIssue} className="flex flex-col md:flex-row gap-6">
            <div className="md:w-1/3">
              {afterImage ? (
                <div className="relative aspect-video w-full rounded-lg overflow-hidden border border-white/10">
                  <img src={afterImage} alt="Resolution state" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setAfterImage("")}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-gray-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className="aspect-video w-full rounded-lg border-2 border-dashed border-white/10 hover:border-red-400/40 bg-white/5 flex flex-col items-center justify-center gap-2 cursor-pointer">
                  <Camera className="w-8 h-8 text-gray-400" />
                  <span className="text-xs text-gray-300 font-bold">Snap Resolution Proof</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleAfterImageChange}
                    className="hidden"
                    required
                  />
                </label>
              )}
            </div>

            <div className="flex-1 flex flex-col gap-4 justify-between">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Resolution Summary & Comments</label>
                <textarea
                  placeholder="Provide brief details on work done (e.g. repaved by Ward PWD team)."
                  value={resolutionComment}
                  onChange={(e) => setResolutionComment(e.target.value)}
                  rows={2}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-xs focus:outline-none focus:border-red-400 transition-colors resize-none"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={actionLoading || !afterImage}
                className="w-full md:w-fit px-6 py-2.5 bg-red-500 text-black font-bold text-xs rounded-lg hover:bg-red-400 transition-colors disabled:opacity-40 cursor-pointer flex items-center justify-center gap-2"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Confirm Resolution & Close Issue (+25 pts)
              </button>
            </div>
          </form>
        </div>
      )}

      {letterModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f0f23] border border-white/10 rounded-2xl w-full max-w-2xl text-left">
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <h3 className="text-white font-semibold">AI Escalation Letter</h3>
              <button onClick={() => setLetterModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <div className="p-6">
              {letterLoading ? (
                <div className="flex items-center gap-3 text-cyan-400 font-mono text-sm">
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
