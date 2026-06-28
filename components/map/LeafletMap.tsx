"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Popup, Circle, CircleMarker, Rectangle, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Issue } from "@/types/issue";
import { useRouter } from "next/navigation";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface LeafletMapProps {
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

// Controller to dynamic update map center/zoom on prop change
function MapController({ center, zoom }: { center: { lat: number; lng: number }; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([center.lat, center.lng], zoom);
  }, [map, center.lat, center.lng, zoom]);
  return null;
}

// Individual animated Crisis Zone Circle
function CrisisCircle({ center }: { center: { lat: number; lng: number } }) {
  const [fillOpacity, setFillOpacity] = useState(0.15);

  useEffect(() => {
    let direction = 1;
    const interval = setInterval(() => {
      setFillOpacity((prev) => {
        let next = prev + 0.01 * direction;
        if (next >= 0.25) {
          direction = -1;
          next = 0.25;
        } else if (next <= 0.05) {
          direction = 1;
          next = 0.05;
        }
        return next;
      });
    }, 100);

    return () => clearInterval(interval);
  }, []);

  return (
    <Circle
      center={[center.lat, center.lng]}
      radius={500}
      pathOptions={{
        color: "#ff3b3b",
        weight: 2,
        opacity: 0.6,
        fillColor: "#ff3b3b",
        fillOpacity: fillOpacity
      }}
    />
  );
}

export default function LeafletMap({
  issues: propIssues,
  center = { lat: 19.076, lng: 72.8777 }, // Default Mumbai
  zoom = 12,
  showHeatmap = false,
  showCrisisZones = true,
  activeCrisisLocations = [],
  onMarkerClick,
  userLocation,
  onLocationChange,
  draggablePin
}: LeafletMapProps) {
  const router = useRouter();
  const [issues, setIssues] = useState<Issue[]>([]);

  // Fetch ALL issues on mount to ensure map is never empty
  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, 'issues'), orderBy('createdAt', 'desc'), limit(200)),
      (snapshot) => {
        const fetched = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Issue[];
        setIssues(fetched);
      },
      (error) => {
        console.error("Failed to load map issues:", error);
      }
    );
    return () => unsubscribe();
  }, []);

  // Use propIssues if they are provided (e.g. from search filters page)
  const mapIssues = propIssues && propIssues.length > 0 ? propIssues : issues;

  // Group issues into 0.01 x 0.01 degree grid cells for custom heatmap
  const gridCells: Record<string, { lat: number; lng: number; count: number }> = {};
  
  mapIssues.forEach((issue) => {
    const lat = issue.location?.lat ?? issue.latitude;
    const lng = issue.location?.lng ?? issue.longitude;
    if (!lat || !lng) return;

    // Grouping by 0.01 degree increments
    const latGrid = Math.floor(lat / 0.01) * 0.01;
    const lngGrid = Math.floor(lng / 0.01) * 0.01;
    const key = `${latGrid.toFixed(2)},${lngGrid.toFixed(2)}`;

    if (!gridCells[key]) {
      gridCells[key] = { lat: latGrid, lng: lngGrid, count: 0 };
    }
    gridCells[key].count += 1;
  });

  return (
    <div className="w-full h-full relative font-sans animate-fade-in" style={{ minHeight: "400px" }}>
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={zoom}
        className="w-full h-full z-0"
        style={{ background: "#080818" }}
        zoomControl={true}
        attributionControl={false}
      >
        <MapController center={center} zoom={zoom} />
        
        {/* Dark CartoDB Map Tiles */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />

        {/* Custom Heatmap Layer using Rectangle Overlays for density */}
        {showHeatmap && Object.entries(gridCells).map(([key, cell]) => {
          const bounds: [[number, number], [number, number]] = [
            [cell.lat, cell.lng],
            [cell.lat + 0.01, cell.lng + 0.01]
          ];
          
          // Density opacity (higher count = redder and more solid)
          const opacity = Math.min(0.7, 0.2 + cell.count * 0.15);

          return (
            <Rectangle
              key={`heat-${key}`}
              bounds={bounds}
              pathOptions={{
                color: "#ff3b3b",
                fillColor: "#ff3b3b",
                fillOpacity: opacity,
                weight: 0.5,
                dashArray: "3, 3"
              }}
            />
          );
        })}

        {/* Crisis Circles */}
        {showCrisisZones && activeCrisisLocations && activeCrisisLocations.map((loc, idx) => (
          <CrisisCircle key={`crisis-${idx}`} center={loc} />
        ))}

        {/* User location dot & outer pulse ring */}
        {userLocation && (
          <>
            <CircleMarker
              center={[userLocation.lat, userLocation.lng]}
              radius={8}
              pathOptions={{ 
                color: '#00d4ff', 
                fillColor: '#00d4ff', 
                fillOpacity: 1,
                weight: 3
              }}
            />
            <Circle
              center={[userLocation.lat, userLocation.lng]}
              radius={100}
              pathOptions={{
                color: '#00d4ff',
                fillColor: '#00d4ff',
                fillOpacity: 0.15,
                weight: 1,
                dashArray: "3, 3"
              }}
            />
          </>
        )}

        {/* Draggable user marker */}
        {userLocation && draggablePin && (
          <Marker
            position={[userLocation.lat, userLocation.lng]}
            draggable={true}
            icon={typeof window !== "undefined" ? L.divIcon({
              className: "custom-div-icon",
              html: `
                <div class="flex items-center justify-center w-8 h-8">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#ff3b3b" class="w-8 h-8 drop-shadow-md">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                  </svg>
                </div>
              `,
              iconSize: [32, 32],
              iconAnchor: [16, 32]
            }) : undefined}
            eventHandlers={{
              dragend: async (e) => {
                const { lat, lng } = e.target.getLatLng()
                if (onLocationChange) {
                  onLocationChange({ lat, lng })
                }
              }
            }}
          />
        )}

        {/* Issue Pins rendered as CircleMarkers */}
        {mapIssues.map((issue) => {
          const lat = issue.location?.lat ?? issue.latitude;
          const lng = issue.location?.lng ?? issue.longitude;
          if (!lat || !lng) return null;

          const isResolved = issue.status === "Resolved" || issue.status === "resolved";

          return (
            <CircleMarker
              key={issue.id}
              center={[lat, lng]}
              radius={issue.severity >= 8 ? 14 : issue.severity >= 5 ? 10 : 7}
              pathOptions={{
                color: isResolved ? '#00ff88' 
                     : issue.severity >= 8 ? '#ff3b3b'
                     : issue.severity >= 5 ? '#ff8c00' 
                     : '#ffd700',
                fillOpacity: 0.85,
                weight: 2
              }}
              eventHandlers={{
                click: () => {
                  if (onMarkerClick) {
                    onMarkerClick(issue);
                  }
                }
              }}
            >
              <Popup>
                <div className="text-black font-sans p-1.5 max-w-[220px]">
                  <h4 className="m-0 mb-1 font-bold text-sm text-gray-900 leading-tight capitalize">{issue.category}</h4>
                  <p className="m-0 mb-2 text-[11px] text-gray-500 leading-snug">{issue.title}</p>
                  <div className="flex justify-between items-center mb-3 text-[10px] text-gray-600">
                    <span>Severity: {issue.severity}/10</span>
                    <span className="font-semibold uppercase tracking-widest text-[8px] px-1.5 py-0.5 rounded bg-gray-100 border border-gray-200">
                      {issue.status}
                    </span>
                  </div>
                  <button
                    onClick={() => router.push(`/issue/${issue.id}`)}
                    className="w-full bg-[#00d4ff] hover:bg-[#00b2d6] text-black font-bold text-xs py-2 px-3 rounded shadow transition-all cursor-pointer text-center block"
                  >
                    View Details & Pulse Log
                  </button>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
