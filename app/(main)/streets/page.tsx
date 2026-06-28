"use client";

import { useState } from "react";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { 
  Search, 
  Activity, 
  AlertTriangle, 
  CheckCircle2, 
  TrendingDown, 
  MapPin, 
  Clock, 
  Info,
  Loader2
} from "lucide-react";

export default function StreetsPage() {
  const { profile } = useAuth();
  
  // Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [streetData, setStreetData] = useState<any>(null);
  const [streetIssues, setStreetIssues] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery) return;
    setLoading(true);
    setError("");
    setSearched(true);
    setStreetData(null);
    setStreetIssues([]);

    try {
      const normalizedQuery = searchQuery.trim().toLowerCase();
      
      // 1. Fetch street profile from streets collection
      const streetDocRef = doc(db, "streets", normalizedQuery);
      const docSnap = await getDoc(streetDocRef);

      // 2. Fetch all issues logged under this street name
      const issuesRef = collection(db, "issues");
      const q = query(issuesRef, where("streetName", "==", searchQuery.trim()));
      const querySnapshot = await getDocs(q);
      const list: any[] = [];
      querySnapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });

      // Sort issues by date
      list.sort((a, b) => {
        const dateA = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt).getTime();
        const dateB = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt).getTime();
        return dateB - dateA;
      });
      setStreetIssues(list);

      if (docSnap.exists()) {
        setStreetData(docSnap.data());
      } else {
        // If street doc doesn't exist but issues exist, create a mock street display
        if (list.length > 0) {
          const resolvedCount = list.filter((i) => i.status === "Resolved").length;
          const activeCount = list.length - resolvedCount;
          const score = Math.max(0, 100 - activeCount * 15);
          
          setStreetData({
            streetName: searchQuery.trim(),
            totalIssues: list.length,
            resolved: resolvedCount,
            categories: Array.from(new Set(list.map((i) => i.category))),
            healthScore: score,
            insight: `Initial reports filed for this street. Health score is currently at ${score}% safety threshold.`
          });
        } else {
          setError(`No records found for "${searchQuery}". Try searching for SV Road or Link Road.`);
        }
      }
    } catch (e) {
      console.error(e);
      setError("Search query diagnostics failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-10 text-white select-none">
      
      {/* Brand Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-wide font-heading text-cyan-400">TEMPORAL STREET MEMORY</h2>
        <p className="text-xs text-gray-400">Search any street profile to check its historical metrics, repeat failures, and safety score card</p>
      </div>

      {/* 1. Search Bar */}
      <form onSubmit={handleSearch} className="glass-card rounded-xl p-4 border border-white/5 flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
          <input
            type="text"
            placeholder="Search street name (e.g. SV Road, Link Road, Carter Road)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-cyan-400 pl-11 transition-colors"
            required
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-3 bg-cyan-500 text-black font-bold text-xs rounded-lg hover:bg-cyan-400 active:scale-98 transition-transform cursor-pointer disabled:opacity-40 flex items-center gap-1.5"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
          Query Memory
        </button>
      </form>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-4 py-3 rounded-lg mb-6 text-center">
          {error}
        </div>
      )}

      {loading && (
        <div className="w-full py-12 flex flex-col items-center justify-center gap-2 text-cyan-400">
          <Loader2 className="w-7 h-7 animate-spin" />
          <span className="text-[10px] uppercase tracking-widest font-semibold font-heading animate-pulse">Retrieving Temporal History...</span>
        </div>
      )}

      {/* 2. Street Profile Details */}
      {searched && streetData && !loading && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          
          {/* Health Index Card */}
          <div className="md:col-span-4 glass-card rounded-xl p-5 border border-white/5 flex flex-col items-center justify-center text-center gap-4">
            <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">Health Index</span>
            <div className="relative w-28 h-28 flex items-center justify-center rounded-full border-4 border-white/5">
              <span className={`text-4xl font-extrabold font-heading ${
                streetData.healthScore >= 80 ? "text-green-400" : streetData.healthScore >= 50 ? "text-yellow-400" : "text-red-400"
              }`}>{streetData.healthScore}</span>
              <span className="absolute inset-0 rounded-full border-2 border-dashed border-cyan-500/20 animate-spin-slow" />
            </div>
            
            <div className="text-xs">
              <span className="block font-bold text-white uppercase">{streetData.streetName}</span>
              <span className="text-gray-500 text-[10px] block mt-0.5">Ward Average Comparison</span>
              <div className="flex gap-4 justify-center items-center mt-2.5 pt-2 border-t border-white/5 text-[10px] text-gray-400">
                <div>
                  <span className="block font-bold text-white">72%</span>
                  <span>Ward Avg</span>
                </div>
                <div className="w-px h-5 bg-white/10" />
                <div>
                  <span className={`block font-bold ${
                    streetData.healthScore >= 72 ? "text-green-400" : "text-red-400"
                  }`}>{streetData.healthScore >= 72 ? "+ " : ""}{streetData.healthScore - 72}%</span>
                  <span>Difference</span>
                </div>
              </div>
            </div>
          </div>

          {/* AI insights card */}
          <div className="md:col-span-8 flex flex-col gap-6">
            
            {/* AI Pattern Summary */}
            <div className="glass-card rounded-xl p-5 border border-white/5 flex flex-col gap-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                <Info className="w-4 h-4" /> AI Historical Insights
              </h3>
              <p className="text-gray-300 italic text-xs leading-relaxed bg-cyan-500/5 p-4 rounded border border-cyan-500/10">
                "{streetData.insight}"
              </p>
              <div className="flex justify-between text-[10px] text-gray-500 pt-1">
                <span>Active categories: <strong className="text-white capitalize">{streetData.categories?.join(", ") || "General"}</strong></span>
                <span>Last updated: {new Date(streetData.lastIssue?.toDate ? streetData.lastIssue.toDate() : streetData.lastIssue).toLocaleDateString()}</span>
              </div>
            </div>

            {/* Incident timeline list */}
            <div className="glass-card rounded-xl p-5 border border-white/5 flex flex-col gap-4">
              <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Historical Incident Timeline</span>
              
              <div className="flex flex-col gap-3 max-h-[220px] overflow-y-auto pr-1">
                {streetIssues.map((issue) => (
                  <div key={issue.id} className="p-3 bg-white/5 border border-white/5 rounded-lg text-xs flex justify-between items-center hover:bg-white/10 transition-colors">
                    <div className="flex items-center gap-3">
                      <Clock className="w-4 h-4 text-cyan-400 shrink-0" />
                      <div>
                        <span className="font-bold text-white block">{issue.title}</span>
                        <span className="text-[10px] text-gray-500">
                          Filed on {issue.createdAt?.toDate ? issue.createdAt.toDate().toLocaleDateString() : new Date(issue.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      issue.status === "Resolved" ? "bg-green-500/20 text-green-400" : "bg-cyan-500/20 text-cyan-400"
                    }`}>
                      {issue.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
