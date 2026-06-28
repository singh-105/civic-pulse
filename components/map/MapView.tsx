"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import { Issue } from "@/types/issue";

interface MapViewProps {
  issues: Issue[];
  center?: { lat: number; lng: number };
  zoom?: number;
  showHeatmap?: boolean;
  showCrisisZones?: boolean;
  activeCrisisLocations?: { lat: number; lng: number; count: number }[];
  onMarkerClick?: (issue: Issue) => void;
  userLocation?: { lat: number; lng: number } | null;
  onLocationChange?: (location: { lat: number; lng: number }) => void;
  draggablePin?: boolean;
}

const LeafletMap = dynamic(() => import("./LeafletMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[400px] bg-[#0d0d21] flex flex-col items-center justify-center gap-3 text-cyan-400">
      <Loader2 className="w-10 h-10 animate-spin" />
      <span className="text-xs uppercase tracking-widest font-semibold font-heading animate-pulse">
        Initializing Spatial Grid...
      </span>
    </div>
  )
});

export default function MapView({
  issues,
  center = { lat: 19.076, lng: 72.8777 },
  zoom = 12,
  showHeatmap = false,
  showCrisisZones = true,
  activeCrisisLocations = [],
  onMarkerClick,
  userLocation,
  onLocationChange,
  draggablePin
}: MapViewProps) {
  return (
    <div className="relative w-full h-full min-h-[400px] rounded-2xl overflow-hidden border border-white/10 shadow-2xl z-0">
      <LeafletMap
        issues={issues}
        center={center}
        zoom={zoom}
        showHeatmap={showHeatmap}
        showCrisisZones={showCrisisZones}
        activeCrisisLocations={activeCrisisLocations}
        onMarkerClick={onMarkerClick}
        userLocation={userLocation}
        onLocationChange={onLocationChange}
        draggablePin={draggablePin}
      />
      
      {/* Visual Map Legend Overlay */}
      <div className="absolute bottom-4 left-4 bg-black/80 backdrop-blur-md p-3 rounded-lg border border-white/10 text-xs flex flex-col gap-1.5 text-white/80 pointer-events-auto z-10">
        <div className="font-bold text-cyan-400 mb-1">CITY PULSE MAP</div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[#ff3b3b] border border-white/30" />
          <span>Critical Severity (8-10)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[#ff8c00] border border-white/30" />
          <span>High Severity (5-7)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[#ffd700] border border-white/30" />
          <span>Medium Severity (1-4)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[#00ff88] border border-white/30" />
          <span>Resolved Issues</span>
        </div>
        {showCrisisZones && activeCrisisLocations && activeCrisisLocations.length > 0 && (
          <div className="flex items-center gap-2 mt-1 pt-1 border-t border-white/10">
            <span className="w-4 h-4 rounded-full border border-red-500 bg-red-500/20 animate-ping" />
            <span className="text-red-400 font-bold">Active Crisis Zone</span>
          </div>
        )}
      </div>
    </div>
  );
}
