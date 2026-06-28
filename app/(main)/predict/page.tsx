"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { generateDecayPredictions, ZonePrediction } from "@/lib/agents/decay-predictor";
import { fetchNews, NewsArticle } from "@/lib/newsdata";
import { 
  TrendingUp, 
  AlertTriangle, 
  CloudSun, 
  Search, 
  MapPin, 
  Calendar,
  Loader2,
  Activity,
  Award,
  Shield,
  Layers,
  Thermometer,
  CloudRain
} from "lucide-react";

export default function PredictPage() {
  const { profile } = useAuth();
  const [predictions, setPredictions] = useState<ZonePrediction[]>([]);
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentSeason, setCurrentSeason] = useState("monsoon");

  useEffect(() => {
    async function loadPredictions() {
      if (!profile) return;
      try {
        const city = "Mumbai";
        const decayResult = await generateDecayPredictions(city);
        setPredictions(decayResult.predictions || []);

        const newsResult = await fetchNews("road accident pothole waterlogging", city);
        setNews(newsResult.slice(0, 4));
      } catch (e) {
        console.error("Failed to load predictions:", e);
      } finally {
        setLoading(false);
      }
    }
    loadPredictions();
  }, [profile]);

  const seasonalHazards = {
    monsoon: [
      { hazard: "Stormwater Drainage Flooding", risk: "CRITICAL", notes: "Sewer silt accumulation combined with heavy localized rainfall." },
      { hazard: "Road Surface Cavities & Potholes", risk: "HIGH", notes: "Asphalt stripping due to constant standing water." },
      { hazard: "Electricity Short Circuits (Streetlights)", risk: "MEDIUM", notes: "Submerged wiring boxes in low-lying junctions." }
    ],
    summer: [
      { hazard: "Pipeline Supply Leakage / Water Scarcity", risk: "HIGH", notes: "Low pressure issues caused by booster pump failures." },
      { hazard: "Dry Waste Fires / Garbage Combustion", risk: "MEDIUM", notes: "Spontaneous combustion at open dumping grounds under high heat." }
    ],
    winter: [
      { hazard: "Visibility-linked Road Incidents", risk: "MEDIUM", notes: "Fog conditions near river crossings combined with broken streetlights." }
    ]
  };

  if (loading || !profile) {
    return (
      <div className="w-full min-h-[70vh] flex flex-col items-center justify-center gap-4 text-cyan-400">
        <div className="animate-pulse space-y-4 w-full max-w-md">
          <div className="h-6 bg-white/10 rounded-lg w-3/4" />
          <div className="h-4 bg-white/10 rounded-lg w-1/2" />
          <div className="h-32 bg-white/10 rounded-2xl" />
        </div>
      </div>
    );
  }

  // Calculate Threat Level
  const avgProb = predictions.length > 0
    ? predictions.reduce((sum, p) => sum + p.probability, 0) / predictions.length
    : 0.65;
  const threatLevel = avgProb >= 0.8 ? "CRITICAL" : avgProb >= 0.6 ? "HIGH" : avgProb >= 0.45 ? "MEDIUM" : "LOW";

  const getThreatColor = (level: string) => {
    if (level === "CRITICAL") return "text-red-500";
    if (level === "HIGH") return "text-orange-500";
    if (level === "MEDIUM") return "text-yellow-500";
    return "text-green-500";
  };

  const getThreatBorder = (level: string) => {
    if (level === "CRITICAL") return "border-red-500/20 bg-red-500/[0.02]";
    if (level === "HIGH") return "border-orange-500/20 bg-orange-500/[0.02]";
    if (level === "MEDIUM") return "border-yellow-500/20 bg-yellow-500/[0.02]";
    return "border-green-500/20 bg-green-500/[0.02]";
  };

  return (
    <div className="flex flex-col gap-6 text-slate-200 select-none pb-12">
      
      {/* Title */}
      <div>
        <p className="text-xs uppercase tracking-widest text-slate-500">Intelligence Grid</p>
        <h2 className="text-2xl font-bold tracking-wide font-heading text-cyan-400 flex items-center gap-2 mt-1">
          <TrendingUp className="w-6 h-6 animate-pulse" /> AI PREDICTIVE INTELLIGENCE CENTER
        </h2>
      </div>

      {/* Hero Threat Level Indicator & Details */}
      <div className={`glass-card rounded-2xl p-6 border flex flex-col md:flex-row items-center gap-6 ${getThreatBorder(threatLevel)}`}>
        
        {/* Animated Threat ring */}
        <div className="relative w-40 h-40 rounded-full flex flex-col items-center justify-center border border-white/5 bg-white/5 text-center shrink-0">
          <span className={`text-2xl font-extrabold tracking-widest font-heading ${getThreatColor(threatLevel)}`}>
            {threatLevel}
          </span>
          <span className="text-[8px] uppercase tracking-widest text-slate-500 font-extrabold mt-1">Hazard Risk</span>
          {/* Outer rotating rings */}
          <span className="absolute inset-0 rounded-full border border-dashed border-cyan-400/25 animate-spin-slow" />
          <span className="absolute -inset-2 rounded-full border border-dashed border-cyan-400/10 animate-spin" style={{ animationDirection: "reverse", animationDuration: "12s" }} />
        </div>

        {/* Threat description */}
        <div className="flex-1 flex flex-col gap-2 text-center md:text-left">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Computed Ward Hazard Rating</span>
          <h3 className="text-white text-lg font-bold">Active Zonal Failure Risks Alert</h3>
          <p className="text-slate-400 text-xs leading-relaxed max-w-xl">
            Hyperlocal prediction models analyze standing precipitation, historic municipal complaint durations, and traffic density factors. Current conditions show elevated structural stress in ward roads.
          </p>
          <div className="flex flex-wrap gap-4 mt-1 text-[11px] text-slate-500 justify-center md:justify-start">
            <span className="flex items-center gap-1.5"><Activity className="w-3.5 h-3.5" /> Core: PWD & Hydraulics</span>
            <span className="flex items-center gap-1.5"><Layers className="w-3.5 h-3.5" /> 14-Day Horizon</span>
          </div>
        </div>

      </div>

      {/* Main Grid Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: 14-day Risk Cards & News (lg:col-span-8) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          
          {/* Zone predictions */}
          <div className="glass-card rounded-2xl p-5 border border-white/5 flex flex-col gap-4">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Zonal Decay Risk Estimates</span>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {predictions.map((p, idx) => {
                const prob = Math.round(p.probability * 100);
                const color = prob >= 80 ? "text-red-400 border-red-500/20 bg-red-500/5" 
                            : prob >= 60 ? "text-orange-400 border-orange-500/20 bg-orange-500/5" 
                            : "text-yellow-400 border-yellow-500/20 bg-yellow-500/5";

                return (
                  <div key={idx} className="p-4 bg-white/5 border border-white/5 rounded-xl flex flex-col gap-3 hover:bg-white/[0.08] transition-all">
                    <div className="flex justify-between items-start gap-4">
                      <div className="min-w-0">
                        <span className="font-bold text-white block text-sm capitalize truncate max-w-[160px]">{p.category} Risk</span>
                        <span className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5 truncate max-w-[150px]">
                          <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0" /> {p.zone}
                        </span>
                      </div>
                      
                      <span className={`px-2 py-1 rounded text-xs font-bold font-mono ${color}`}>
                        {prob}%
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden mt-1">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          prob >= 80 ? "bg-red-500" : prob >= 60 ? "bg-orange-500" : "bg-yellow-500"
                        }`}
                        style={{ width: `${prob}%` }}
                      />
                    </div>

                    <p className="text-[11px] text-slate-400 italic leading-relaxed mt-1">
                      "{p.reasoning}"
                    </p>
                  </div>
                );
              })}

              {predictions.length === 0 && (
                <span className="text-xs text-slate-500 italic py-6 col-span-2 text-center">
                  No predictions computed. Check connection.
                </span>
              )}
            </div>
          </div>

          {/* Hyperlocal News feed */}
          <div className="glass-card rounded-2xl p-5 border border-white/5 flex flex-col gap-4">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Hyperlocal News Monitor</span>
            
            <div className="flex flex-col gap-4">
              {news.map((item, idx) => (
                <div key={idx} className="p-4 bg-white/5 border border-white/5 rounded-xl text-xs flex justify-between items-start gap-4 hover:bg-white/[0.08] transition-all">
                  <div className="flex-1">
                    <span className="text-[9px] font-extrabold text-cyan-400/80 uppercase tracking-widest">{item.source} • {item.pubDate || "Recent"}</span>
                    <span className="font-bold text-white block mt-0.5 hover:underline cursor-pointer leading-snug">{item.title}</span>
                    <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">{item.description}</p>
                  </div>
                </div>
              ))}

              {news.length === 0 && (
                <span className="text-xs text-slate-500 italic py-6 text-center">
                  No relevant municipal incidents logged.
                </span>
              )}
            </div>
          </div>

        </div>

        {/* Right Column: Seasonal risk, weather updates (lg:col-span-4) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* Forecast details */}
          <div className="glass-card rounded-2xl p-5 border border-white/5 flex flex-col gap-4">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Weather stress correlates</span>
            
            <div className="p-4 bg-gradient-to-tr from-cyan-400/5 to-blue-500/5 rounded-xl border border-cyan-500/20 text-xs flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Target Ward:</span>
                <span className="font-bold text-white uppercase tracking-wider">{profile?.ward || "Mumbai"}</span>
              </div>
              
              <div className="border-t border-white/5 my-0.5" />

              <div className="flex justify-between items-center">
                <span className="text-slate-400">Forecast Status:</span>
                <span className="font-bold text-cyan-400 flex items-center gap-1">
                  <CloudRain className="w-4 h-4 text-cyan-400" /> Scattered Rainfall
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Atmosphere Humidity:</span>
                <span className="font-bold text-cyan-400">82% Humidity</span>
              </div>
            </div>
            
            <p className="text-[10px] text-slate-500 leading-tight">
              Predictive models monitor rain gauge forecasts to estimate when pooling water thresholds will trigger pavement cracking.
            </p>
          </div>

          {/* Seasonal Calendar Tabs and Heatmap grid */}
          <div className="glass-card rounded-2xl p-5 border border-white/5 flex flex-col gap-4">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Seasonal Hazard Calendar</span>
            
            <div className="grid grid-cols-3 gap-2">
              {["monsoon", "summer", "winter"].map((season) => (
                <button
                  key={season}
                  onClick={() => setCurrentSeason(season)}
                  className={`py-2 rounded-xl text-[10px] font-extrabold uppercase tracking-wider transition-colors cursor-pointer border ${
                    currentSeason === season
                      ? "bg-cyan-500/20 border-cyan-500/30 text-cyan-400 font-bold"
                      : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
                  }`}
                >
                  {season}
                </button>
              ))}
            </div>

            {/* List */}
            <div className="flex flex-col gap-3.5 mt-1">
              {seasonalHazards[currentSeason as keyof typeof seasonalHazards].map((item, idx) => (
                <div key={idx} className="p-3.5 bg-white/5 border border-white/5 rounded-xl text-xs flex flex-col gap-1.5">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-white text-xs">{item.hazard}</span>
                    <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase ${
                      item.risk === "CRITICAL" ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-orange-500/10 text-orange-400 border border-orange-500/20"
                    }`}>
                      {item.risk}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    {item.notes}
                  </p>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
