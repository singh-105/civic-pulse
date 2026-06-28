"use client";

import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Issue } from "@/types/issue";
import MapView from "@/components/map/MapView";
import { 
  SlidersHorizontal, 
  Map as MapIcon, 
  Flame, 
  Filter, 
  ShieldAlert,
  Loader2,
  TrendingDown
} from "lucide-react";

export default function MapPage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [filteredIssues, setFilteredIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [minSeverity, setMinSeverity] = useState(1);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showCrisis, setShowCrisis] = useState(true);

  // Load issues
  useEffect(() => {
    async function loadIssues() {
      try {
        const querySnapshot = await getDocs(collection(db, "issues"));
        const list: Issue[] = [];
        querySnapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as Issue);
        });
        setIssues(list);
        setFilteredIssues(list);
      } catch (error) {
        console.error("Failed to load map issues:", error);
      } finally {
        setLoading(false);
      }
    }
    loadIssues();
  }, []);

  // Process filters
  useEffect(() => {
    let result = [...issues];

    if (categoryFilter !== "all") {
      result = result.filter((i) => i.category === categoryFilter);
    }
    if (statusFilter !== "all") {
      result = result.filter((i) => i.status === statusFilter);
    }
    result = result.filter((i) => i.severity >= minSeverity);

    setFilteredIssues(result);
  }, [categoryFilter, statusFilter, minSeverity, issues]);

  // Extract crisis centers (Escalated issues)
  const activeCrisisLocations = issues
    .filter((i) => i.status === "Escalated" && i.latitude && i.longitude)
    .map((i) => ({ lat: i.latitude, lng: i.longitude, count: 3 }));

  if (loading) {
    return (
      <div className="w-full min-h-[70vh] flex flex-col items-center justify-center gap-2 text-cyan-400">
        <Loader2 className="w-8 h-8 animate-spin" />
        <span className="text-xs uppercase tracking-widest font-semibold font-heading animate-pulse">Initializing Holographic Map...</span>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[calc(100vh-140px)] min-h-[500px] flex flex-col lg:flex-row gap-6">
      
      {/* 1. Left Side: Controls Panel */}
      <div className="w-full lg:w-80 shrink-0 glass-card rounded-2xl p-5 border border-white/5 flex flex-col gap-5 text-white z-10 overflow-y-auto">
        <div className="flex items-center gap-2 pb-3 border-b border-white/5">
          <SlidersHorizontal className="w-5 h-5 text-cyan-400" />
          <h2 className="font-bold text-sm uppercase tracking-wider font-heading">Control Dashboard</h2>
        </div>

        {/* Filter Category */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
            <Filter className="w-3 h-3 text-cyan-400" /> Filter by Category
          </label>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-cyan-400 capitalize cursor-pointer"
          >
            <option value="all">All Categories</option>
            <option value="pothole">pothole</option>
            <option value="drain">drainage</option>
            <option value="light">streetlights</option>
            <option value="water">water supply</option>
            <option value="garbage">garbage pile</option>
            <option value="construction">illegal construction</option>
          </select>
        </div>

        {/* Filter Status */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
            <Filter className="w-3 h-3 text-cyan-400" /> Filter by Status
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-cyan-400 capitalize cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="Reported">Reported</option>
            <option value="Verified">Verified</option>
            <option value="Escalated">Escalated</option>
            <option value="Assigned">Assigned</option>
            <option value="Resolved">Resolved</option>
          </select>
        </div>

        {/* Severity Slider */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
            Minimum Severity (≥ {minSeverity})
          </label>
          <input
            type="range"
            min="1"
            max="10"
            value={minSeverity}
            onChange={(e) => setMinSeverity(Number(e.target.value))}
            className="w-full accent-cyan-400 cursor-pointer"
          />
        </div>

        {/* Layer Controls */}
        <div className="flex flex-col gap-2.5 pt-3 border-t border-white/5">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Holographic Overlays</span>
          
          <button
            type="button"
            onClick={() => setShowHeatmap(!showHeatmap)}
            className={`w-full py-2.5 px-4 rounded-lg border text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
              showHeatmap 
                ? "bg-amber-500/20 border-amber-500/40 text-amber-400" 
                : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10"
            }`}
          >
            <span className="flex items-center gap-2">
              <Flame className="w-4 h-4" /> Gemini Heatmap Layer
            </span>
            <span className="text-[9px] uppercase">{showHeatmap ? "ON" : "OFF"}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowCrisis(!showCrisis)}
            className={`w-full py-2.5 px-4 rounded-lg border text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
              showCrisis 
                ? "bg-red-500/20 border-red-500/40 text-red-400" 
                : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10"
            }`}
          >
            <span className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4" /> Crisis Circle Overlays
            </span>
            <span className="text-[9px] uppercase">{showCrisis ? "ON" : "OFF"}</span>
          </button>
        </div>

        {/* Map stats */}
        <div className="mt-auto p-3.5 bg-white/5 rounded-lg border border-white/5 text-[11px] text-gray-400 flex flex-col gap-1.5">
          <div className="flex justify-between">
            <span>Filtered Pins:</span>
            <span className="font-bold text-white">{filteredIssues.length}</span>
          </div>
          <div className="flex justify-between">
            <span>Total Active Crises:</span>
            <span className="font-bold text-red-400">{activeCrisisLocations.length}</span>
          </div>
        </div>
      </div>

      {/* 2. Right Side: Map Canvas */}
      <div className="flex-1 w-full h-full relative">
        <MapView
          issues={filteredIssues}
          showHeatmap={showHeatmap}
          showCrisisZones={showCrisis}
          activeCrisisLocations={activeCrisisLocations}
        />
      </div>

    </div>
  );
}
