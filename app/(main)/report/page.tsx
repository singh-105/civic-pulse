"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useGamification } from "@/hooks/useGamification";
import { detectDuplicateIssue } from "@/lib/agents/duplicate-detector";
import { doc, getDoc, setDoc, updateDoc, arrayUnion, collection, addDoc, increment, serverTimestamp } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { updateStreetMemory } from "@/lib/agents/street-memory";
import MapView from "@/components/map/MapView";
import { 
  Camera, 
  MapPin, 
  AlertTriangle, 
  Loader2, 
  Check, 
  CheckCircle2, 
  X,
  ChevronLeft,
  ChevronRight,
  Info,
  Layers,
  Sparkles,
  User,
  Heart
} from "lucide-react";

// Image analysis (in report page):
const analyzeImage = async (imageBase64: string) => {
  const res = await fetch('/api/gemini/analyze-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64 })
  });
  if (!res.ok) throw new Error('Analysis failed');
  return res.json();
};

export default function ReportPage() {
  const router = useRouter();
  const { user: currentUser, profile } = useAuth();
  const { addPoints } = useGamification();
  const mapRef = useRef<any>(null);

  // Wizard Steps: 1. Photo, 2. Location, 3. Details, 4. Review
  const [formStep, setFormStep] = useState<number>(1);

  // Form states
  const [image, setImage] = useState<string>(""); // Base64
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("pothole");
  const [subcategory, setSubcategory] = useState("");
  const [severity, setSeverity] = useState<number>(5);
  const [rootCause, setRootCause] = useState("");
  const [affectedPopulation, setAffectedPopulation] = useState<number>(15);
  const [anonymous, setAnonymous] = useState(false);
  
  // Location states
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [address, setAddress] = useState("");
  const [streetName, setStreetName] = useState("");

  // Nominatim Autocomplete states
  const [addressSearchQuery, setAddressSearchQuery] = useState("");
  const [addressSearchResults, setAddressSearchResults] = useState<any[]>([]);

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const loading = submitting;
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  
  // Voice state
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const [interimText, setInterimText] = useState('');

  const [dnaData, setDnaData] = useState<any>(null);
  const [aiFailed, setAiFailed] = useState(false);
  const [aiFallback, setAiFallback] = useState(false);

  // Duplicate states
  const [duplicateWarning, setDuplicateWarning] = useState<any>(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);

  // Auto-capture GPS coordinates on step 2 mount
  useEffect(() => {
    if (formStep === 2) {
      getUserLocation();
    }
  }, [formStep]);

  const getUserLocation = () => {
    setLocationLoading(true);
    setLocationError(null);
    
    if (!navigator.geolocation) {
      setLocationError('Geolocation not supported');
      setLocationLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        
        setLocation({ lat, lng });
        setLocationLoading(false);
        
        // Reverse geocode with Nominatim proxy:
        try {
          const res = await fetch(
            `/api/geocode?lat=${lat}&lng=${lng}`
          );
          const data = await res.json();
          setAddress(data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`);
          setStreetName(data.address?.road || data.address?.suburb || '');
        } catch {
          setAddress(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        }
      },
      (error) => {
        setLocationLoading(false);
        switch(error.code) {
          case error.PERMISSION_DENIED:
            setLocationError('Location permission denied. Please allow location access.');
            break;
          case error.POSITION_UNAVAILABLE:
            setLocationError('Location unavailable. Try again.');
            break;
          default:
            setLocationError('Could not get location. Try again.');
        }
      },
      { 
        enableHighAccuracy: true,  // GPS not WiFi
        timeout: 10000,
        maximumAge: 0              // always fresh, never cached
      }
    );
  };

  const handleLocationChange = async (newLoc: { lat: number; lng: number }) => {
    setLocation(newLoc);
    // Re-reverse geocode new position via proxy:
    try {
      const res = await fetch(
        `/api/geocode?lat=${newLoc.lat}&lng=${newLoc.lng}`
      );
      const data = await res.json();
      setAddress(data.display_name || `${newLoc.lat.toFixed(4)}, ${newLoc.lng.toFixed(4)}`);
      setStreetName(data.address?.road || data.address?.suburb || '');
    } catch {
      setAddress(`${newLoc.lat.toFixed(4)}, ${newLoc.lng.toFixed(4)}`);
    }
  };

  const toggleVoice = () => {
    const SpeechRecognition = 
      (window as any).SpeechRecognition || 
      (window as any).webkitSpeechRecognition

    if (!SpeechRecognition) {
      alert('Use Chrome browser for voice input')
      return
    }

    if (isListening) {
      recognitionRef.current?.stop()
      setIsListening(false)
      setInterimText('')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = 'en-IN'
    recognition.continuous = true
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      setIsListening(true)
    }

    recognition.onresult = (event: any) => {
      let finalTranscript = ''
      let interimTranscript = ''
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalTranscript += transcript
        } else {
          interimTranscript += transcript
        }
      }
      
      if (finalTranscript) {
        setDescription(prev => {
          const cleanedPrev = prev.trim()
          return cleanedPrev ? cleanedPrev + ' ' + finalTranscript.trim() : finalTranscript.trim()
        })
      }
      setInterimText(interimTranscript)
    }

    recognition.onerror = (event: any) => {
      setIsListening(false)
      setInterimText('')
      console.error('Speech error:', event.error)
      if (event.error === 'network') {
        alert('Voice input needs HTTPS. Run: npm run dev -- --experimental-https')
      } else if (event.error === 'not-allowed') {
        alert('Allow microphone in Chrome → lock icon → Site settings → Microphone → Allow')
      }
    }

    recognition.onend = () => {
      setIsListening(false)
      setInterimText('')
    }

    recognitionRef.current = recognition
    
    try {
      recognition.start()
    } catch(e) {
      console.error('Recognition start failed:', e)
    }
  }

  // Convert uploaded image to base64
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setImage(base64String);
        triggerAiAnalysis(base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  // Trigger Gemini Vision Analysis
  const triggerAiAnalysis = async (base64Img: string) => {
    if (!base64Img) return;
    setAiAnalyzing(true);
    setAiFailed(false);
    setAiFallback(false);
    setError("");
    
    try {
      const data = await analyzeImage(base64Img);

      if (data.isFallback) {
        setAiFallback(true);
      }

      if (data.category) setCategory(data.category);
      if (data.subcategory) setSubcategory(data.subcategory);
      if (data.severity) setSeverity(data.severity);
      if (data.rootCause) setRootCause(data.rootCause);
      if (data.affectedArea) {
        const match = data.affectedArea.match(/\d+/);
        setAffectedPopulation(match ? Number(match[0]) : 25);
      }
      setDnaData(data);
      
      setTitle(`Active ${data.subcategory || data.category} detected`);
      
      // Auto advance to next step for slick user flow
      setFormStep(2);
    } catch (err: any) {
      console.error(err);
      setAiFailed(true);
      setError("AI analysis failed. You can fill out the form manually.");
    } finally {
      setAiAnalyzing(false);
    }
  };

  // Duplicate Check
  const handleDuplicateCheck = async () => {
    if (location?.lat && location?.lng && category) {
      const result = await detectDuplicateIssue(location.lat, location.lng, category);
      if (result.isDuplicate) {
        setDuplicateWarning(result.duplicateIssue);
        setShowDuplicateModal(true);
        return true;
      }
    }
    return false;
  };

  // Autocomplete search via proxy Nominatim
  const handleAddressSearch = async (value: string) => {
    setAddressSearchQuery(value);
    setAddress(value);
    if (value.length < 3) {
      setAddressResults([]);
      return;
    }
    try {
      const response = await fetch(
        `/api/geocode?q=${encodeURIComponent(value)}`
      );
      const data = await response.json();
      setAddressResults(data || []);
    } catch {
      setAddressResults([]);
    }
  };

  // Select autocomplete address
  const handleSelectAddress = async (result: any) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    setLocation({ lat, lng });
    setAddress(result.display_name);
    setStreetName(result.address?.road || result.address?.suburb || '');
    setAddressResults([]);
    if (mapRef.current) {
      mapRef.current.setView([lat, lng], 17);
    }
  };

  // Upvote duplicate
  const handleUpvoteExisting = async () => {
    if (!profile || !duplicateWarning) return;
    setLoading(true);
    try {
      const issueRef = doc(db, "issues", duplicateWarning.id);
      await updateDoc(issueRef, {
        upvotes: (duplicateWarning.upvotes || 0) + 1,
        upvotedBy: arrayUnion(profile.uid),
        verifiedBy: arrayUnion(profile.uid)
      });

      await addPoints(profile.uid, 5, "Verified duplicate issue");
      setSuccess(true);
      setTimeout(() => {
        router.push("/dashboard");
      }, 2000);
    } catch (e) {
      console.error(e);
      setError("Failed to verify existing report.");
    } finally {
      setLoading(false);
      setShowDuplicateModal(false);
    }
  };

  // Submit report handler
  // Submit report handler
  const handleSubmit = async (e?: React.FormEvent | React.MouseEvent, bypassDuplicate = false) => {
    if (e && (e as any).preventDefault) (e as any).preventDefault();

    const user = auth.currentUser;
    if (!user) {
      window.location.replace('/login');
      return;
    }
    if (!location) {
      setError('Please capture location first');
      return;
    }
    if (!title?.trim()) {
      setError('Please add a title');
      return;
    }

    setSubmitting(true);
    setError('');

    const isAnonymous = anonymous;
    const imageBase64 = image;

    if (!bypassDuplicate) {
      const isDuplicate = await handleDuplicateCheck();
      if (isDuplicate) {
        setSubmitting(false);
        return;
      }
    }

    try {
      const issueData: any = {
        title: title.trim(),
        description: description?.trim() || '',
        category: dnaData?.category || category || 'OTHER',
        subcategory: dnaData?.subcategory || '',
        severity: Number(severity) || 5,
        status: 'reported',
        location: {
          lat: location.lat,
          lng: location.lng,
          address: address || ''
        },
        streetName: streetName || '',
        imageBase64: imageBase64 || '',
        reportedBy: user.uid,
        reporterPhone: user.phoneNumber || '',
        isAnonymous: isAnonymous || false,
        upvotes: 0,
        upvotedBy: [],
        verifiedBy: [],
        comments: [],
        createdAt: serverTimestamp(),
        issueDNA: {
          rootCause: dnaData?.rootCause || '',
          affectedPopulation: dnaData?.affectedPopulation || '',
          recommendedFix: dnaData?.recommendedFix || '',
          urgency: dnaData?.urgency || 'Medium'
        },
        wardNumber: profile?.ward || '',
        
        // Backward compatibility fields matching the Issue interface:
        latitude: location.lat,
        longitude: location.lng,
        address: address || '',
        image: image || '',
        reporterId: user.uid,
        reporterName: isAnonymous ? 'Anonymous Citizen' : (profile?.name || 'Citizen'),
        anonymous: isAnonymous || false,
        ward: profile?.ward || 'Ward 12',
        timeline: [
          {
            status: 'reported',
            updatedBy: isAnonymous ? 'Anonymous Citizen' : (profile?.name || 'Citizen'),
            updatedAt: new Date().toISOString(),
            comment: 'Issue logged in CivicPulse portal.'
          }
        ],
        negotiationLog: []
      };

      // Remove undefined values
      Object.keys(issueData).forEach(key => {
        if (issueData[key] === undefined) delete issueData[key];
      });

      const docRef = await addDoc(collection(db, 'issues'), issueData);

      // Add points if not anonymous
      if (!isAnonymous) {
        await updateDoc(doc(db, 'users', user.uid), {
          points: increment(10),
          pointHistory: arrayUnion({
            points: 10,
            reason: 'Issue reported',
            issueId: docRef.id,
            timestamp: new Date().toISOString()
          })
        });
      }

      // Update street memory
      const streetRef = doc(db, 'streets', streetName || location.lat.toFixed(3));
      const streetSnap = await getDoc(streetRef);
      if (streetSnap.exists()) {
        await updateDoc(streetRef, {
          totalIssues: increment(1),
          lastIssue: new Date().toISOString(),
          categories: arrayUnion(dnaData?.category || category || 'OTHER')
        });
      } else {
        await setDoc(streetRef, {
          streetName: streetName || address,
          totalIssues: 1,
          resolved: 0,
          categories: [dnaData?.category || category || 'OTHER'],
          lastIssue: new Date().toISOString(),
          healthScore: 70
        });
      }

      window.location.href = `/issue/${docRef.id}`;

    } catch (err: any) {
      console.error('Submit error:', err);
      setError('Submission failed: ' + err.message);
      setSubmitting(false);
    }
  };

  const nextStep = () => {
    if (formStep === 1 && !image) {
      setError("Visual proof is mandatory. Please upload a photo.");
      return;
    }
    if (formStep === 2 && (!location?.lat || !location?.lng)) {
      setError("Spatial coordinates must be located. Search or geolocate location.");
      return;
    }
    setError("");
    setFormStep((prev) => Math.min(prev + 1, 4));
  };

  const prevStep = () => {
    setError("");
    setFormStep((prev) => Math.max(prev - 1, 1));
  };

  // Temp issues array for Step 2 location pin visual
  const tempMapIssues = location?.lat && location?.lng ? [{
    id: "temp-loc",
    title: title || "Logged Spot",
    description: "",
    category: category,
    severity: severity,
    status: "reported",
    latitude: location.lat,
    longitude: location.lng,
    location: { lat: location.lat, lng: location.lng, address: address }
  } as any] : [];

  return (
    <div className="flex flex-col gap-6 text-slate-200 select-none pb-12">
      
      {/* Title */}
      <div>
        <p className="text-xs uppercase tracking-widest text-slate-500">Triage Center</p>
        <h2 className="text-2xl font-bold tracking-wide font-heading text-white mt-1">REPORT HYPERLOCAL FAULT</h2>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-4 py-3 rounded-xl flex items-start gap-2.5 animate-fade-in">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {aiFallback && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs px-4 py-3 rounded-xl flex items-start gap-2.5 animate-fade-in">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>AI quota limit reached. Results are estimated.</span>
        </div>
      )}

      {success && (
        <div className="bg-green-500/10 border border-green-500/20 text-green-400 text-sm px-4 py-6 rounded-xl flex flex-col items-center gap-3 text-center shadow-lg shadow-green-500/10 animate-fade-in">
          <CheckCircle2 className="w-12 h-12 text-green-400 animate-bounce" />
          <span className="font-bold text-base">Issue Registered Successfully!</span>
          <span className="text-xs text-slate-400">Awarded +10 Points. Synchronizing Ward Ledger...</span>
        </div>
      )}

      {/* Main Two-Panel Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* ========================================================
            LEFT PANEL: 4-STEP WIZARD FORM (lg:col-span-7)
            ======================================================== */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          
          {/* Step Indicator Header */}
          <div className="glass-card rounded-2xl p-4 border border-white/5 flex items-center justify-between text-xs font-semibold text-slate-500">
            <span className={formStep === 1 ? "text-cyan-400 font-bold" : ""}>1. Photo</span>
            <ChevronRight className="w-4 h-4 shrink-0" />
            <span className={formStep === 2 ? "text-cyan-400 font-bold" : ""}>2. Location</span>
            <ChevronRight className="w-4 h-4 shrink-0" />
            <span className={formStep === 3 ? "text-cyan-400 font-bold" : ""}>3. Details</span>
            <ChevronRight className="w-4 h-4 shrink-0" />
            <span className={formStep === 4 ? "text-cyan-400 font-bold" : ""}>4. Review</span>
          </div>

          {/* Form Wizard Container */}
          <div className="glass-card rounded-2xl p-6 border border-white/5 flex flex-col gap-6 min-h-[350px]">
            
            {/* STEP 1: PHOTO UPLOAD */}
            {formStep === 1 && (
              <div className="flex flex-col gap-5 animate-fade-in">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Step 1: Visual Evidence Triage</span>
                
                <div className="border border-dashed border-white/10 rounded-2xl p-8 flex flex-col items-center justify-center text-center relative group min-h-[240px] bg-[#0f0f23]/40 overflow-hidden">
                  {image ? (
                    <>
                      <img 
                        src={image} 
                        alt="Visual Evidence" 
                        className="absolute inset-0 w-full h-full object-cover" 
                      />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <label className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5">
                          <Camera className="w-4 h-4" /> Change Photo
                          <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                        </label>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-3 animate-pulse">
                        <Camera className="w-7 h-7" />
                      </div>
                      <div>
                        <span className="block font-bold text-white text-sm mb-1">Visual Evidence Upload</span>
                        <p className="text-slate-400 text-xs leading-relaxed max-w-[240px] mx-auto">
                          Drag and drop or upload a photo showing infrastructure damage, water leaks, or road faults.
                        </p>
                      </div>
                      <label className="mt-4 px-5 py-2.5 bg-cyan-500 text-black text-xs font-bold rounded-xl hover:bg-cyan-400 cursor-pointer transition-colors shadow-lg shadow-cyan-500/20">
                        Select Image
                        <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                      </label>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* STEP 2: LOCATION SETTINGS */}
            {formStep === 2 && (
              <div className="flex flex-col gap-5 animate-fade-in">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Step 2: Spatial Geolocation Pin</span>
                
                {/* Search query box */}
                <div className="flex flex-col gap-1.5 relative">
                  <label className="text-[10px] text-slate-400 uppercase font-semibold">Verify Location Coordinates</label>
                  <input
                    type="text"
                    placeholder="Search address or area manually..."
                    value={addressSearchQuery}
                    onChange={(e) => handleAddressSearch(e.target.value)}
                    className="w-full bg-[#0f0f23] border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-cyan-400/50"
                  />
                  {addressSearchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-black/95 border border-white/10 rounded-lg shadow-xl z-50 max-h-40 overflow-y-auto">
                      {addressSearchResults.map((res: any, idx: number) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSelectAddress(res)}
                          className="w-full text-left px-3 py-2.5 text-[11px] text-slate-300 hover:bg-cyan-500/10 hover:text-cyan-400 border-b border-white/5 last:border-0 truncate block cursor-pointer"
                        >
                          {res.display_name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {locationLoading && (
                  <div className="flex items-center gap-2 text-xs text-cyan-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Locating you...</span>
                  </div>
                )}

                {locationError && (
                  <div className="flex flex-col gap-1.5 animate-fade-in">
                    <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg">
                      {locationError}
                    </div>
                    <button
                      type="button"
                      onClick={getUserLocation}
                      className="px-3 py-1.5 bg-white/5 border border-white/10 hover:bg-white/10 text-[10px] font-bold rounded-lg text-slate-300 transition-colors w-fit flex items-center gap-1.5 cursor-pointer"
                    >
                      <MapPin className="w-3.5 h-3.5" /> Use my location
                    </button>
                  </div>
                )}

                {!locationLoading && !locationError && (
                  <button
                    type="button"
                    onClick={getUserLocation}
                    className="px-3 py-1.5 bg-white/5 border border-white/10 hover:bg-white/10 text-[10px] font-bold rounded-lg text-slate-300 transition-colors w-fit flex items-center gap-1.5 cursor-pointer"
                  >
                    <MapPin className="w-3.5 h-3.5" /> Re-detect My Location
                  </button>
                )}

                {/* Map preview */}
                <div className="h-44 rounded-xl overflow-hidden border border-white/10 relative z-0">
                  <MapView 
                    issues={tempMapIssues} 
                    center={location ? { lat: location.lat, lng: location.lng } : undefined}
                    zoom={15}
                    showCrisisZones={false}
                    userLocation={location}
                    onLocationChange={handleLocationChange}
                    draggablePin={true}
                  />
                </div>

                <div className="flex items-start gap-3 bg-white/5 p-3 rounded-xl border border-white/5 text-xs text-slate-300">
                  <MapPin className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <span className="block font-bold text-white truncate capitalize">{streetName || "Hyperlocal Street"}</span>
                    <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">{address || "Fetching address coordinates..."}</p>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: SPECIFIC DETAILS */}
            {formStep === 3 && (
              <div className="flex flex-col gap-5 animate-fade-in">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Step 3: Fault Parameters</span>
                
                {/* Title */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Report Title</label>
                  <input
                    type="text"
                    placeholder="Brief description (e.g. Broken water pipe)"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-[#0f0f23] border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-cyan-400/50"
                    required
                  />
                </div>

                {/* Description & Voice */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Issue Description</label>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={toggleVoice}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                          isListening
                            ? 'bg-red-500/20 text-red-400 border border-red-500/50 animate-pulse'
                            : 'bg-white/5 text-slate-400 border border-white/10 hover:text-cyan-400'
                        }`}
                      >
                        {isListening ? '🔴 Stop' : '🎤 Dictate'}
                      </button>
                    </div>
                  </div>
                  <textarea
                    placeholder="Describe what you see. You can dictate by clicking the mic icon."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="w-full bg-[#0f0f23] border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-cyan-400/50 resize-none"
                    required
                  />
                  {isListening && (
                    <div className="flex flex-col gap-1 mt-1">
                      <p className="text-red-400 text-[10px] font-semibold animate-pulse flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping inline-block"></span>
                        Listening... Speak now
                      </p>
                      {interimText && (
                        <p className="text-slate-400 text-xs italic bg-white/5 border border-white/5 rounded px-2 py-1.5">
                          <span className="text-cyan-400 font-bold not-italic mr-1.5">Live:</span>
                          {interimText}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Severity slider */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <span>Severity index</span>
                    <span className="text-cyan-400">{severity}/10</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={severity}
                    onChange={(e) => setSeverity(Number(e.target.value))}
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                </div>
              </div>
            )}

            {/* STEP 4: REVIEW & CONFIRM */}
            {formStep === 4 && (
              <div className="flex flex-col gap-5 animate-fade-in">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Step 4: Final Triage Review</span>
                
                {/* Preview details */}
                <div className="p-4 bg-white/5 border border-white/5 rounded-2xl flex flex-col gap-3">
                  {image && (
                    <img src={image} alt="Report proof" className="w-full h-32 object-cover rounded-xl border border-white/10" />
                  )}
                  <div>
                    <span className="text-[10px] text-cyan-400 font-extrabold uppercase tracking-widest block capitalize">{category}</span>
                    <strong className="text-white text-sm block mt-0.5">{title || "Untitled Issue"}</strong>
                    <p className="text-[11px] text-slate-400 mt-1 leading-relaxed line-clamp-3">
                      {description || "No description provided."}
                    </p>
                  </div>
                  
                  <div className="border-t border-white/5 my-0.5" />
                  
                  <div className="flex flex-col gap-1 text-[10px] text-slate-500">
                    <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 shrink-0" /> {address}</span>
                    <span className="flex items-center gap-1.5 mt-0.5"><Sparkles className="w-3.5 h-3.5 shrink-0 text-cyan-400" /> Severity: {severity}/10</span>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-400">
                    <input
                      type="checkbox"
                      checked={anonymous}
                      onChange={(e) => setAnonymous(e.target.checked)}
                      className="rounded border-white/10 bg-[#0f0f23] text-cyan-500 focus:ring-0 cursor-pointer"
                    />
                    <span>Submit anonymous report</span>
                  </label>
                </div>
              </div>
            )}

            {/* Navigation buttons */}
            <div className="flex justify-between mt-auto pt-6 border-t border-white/5">
              {formStep > 1 ? (
                <button
                  type="button"
                  onClick={prevStep}
                  className="px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
              ) : (
                <div />
              )}

              {formStep < 4 ? (
                <button
                  type="button"
                  onClick={nextStep}
                  className="px-4 py-2 bg-cyan-400 text-black text-xs font-bold rounded-xl hover:bg-cyan-300 transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-cyan-400/25"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading}
                  className="px-6 py-2 bg-cyan-500 text-black text-xs font-bold rounded-xl hover:bg-cyan-400 transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-cyan-500/20 disabled:opacity-40"
                >
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Submit Report (+10 pts)
                </button>
              )}
            </div>

          </div>
        </div>

        {/* ========================================================
            RIGHT PANEL: AI INCIDENT DNA ANALYSIS (lg:col-span-5)
            ======================================================== */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-500">Diagnostic Grid</p>
            <h3 className="text-lg font-bold text-white mt-0.5">Gemini Incident DNA</h3>
          </div>

          <div className="glass-card rounded-2xl p-5 border border-white/5 min-h-[300px] flex flex-col gap-4">
            
            {/* Analyzing loader */}
            {aiAnalyzing ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-cyan-400">
                <Loader2 className="w-8 h-8 animate-spin" />
                <span className="text-xs uppercase tracking-widest font-semibold font-heading animate-pulse">
                  Analyzing image...
                </span>
              </div>
            ) : aiFailed ? (
              <div className="flex flex-col items-center justify-center text-center py-12 text-red-400 gap-3">
                <AlertTriangle className="w-8 h-8 text-red-400" />
                <span className="font-bold text-xs">AI unavailable - fill manually</span>
                <p className="text-[10px] text-slate-500 max-w-[200px] leading-relaxed">
                  The automated diagnostics service is offline. You can still fill out the form details and submit successfully.
                </p>
              </div>
            ) : image ? (
              <div className="flex flex-col gap-4 animate-fade-in">
                
                {/* DNA badge */}
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-cyan-400 font-extrabold uppercase tracking-widest flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> Triage DNA Profile
                  </span>
                  <span className="text-[9px] text-slate-500 font-bold uppercase">Real-Time Sync</span>
                </div>

                {aiFallback && (
                  <div className="bg-yellow-500/10 border border-yellow-500/25 text-yellow-400 text-[10px] px-3 py-2 rounded-xl flex items-start gap-2 animate-fade-in">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>AI quota limit reached. Results are estimated.</span>
                  </div>
                )}

                {/* Details */}
                <div className="flex flex-col gap-3 text-xs bg-white/5 p-4 rounded-xl border border-white/5 text-slate-300">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[9px] text-slate-500 uppercase font-semibold">Triage Class</span>
                      <strong className="text-white capitalize">{category} {subcategory ? `(${subcategory})` : ""}</strong>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[9px] text-slate-500 uppercase font-semibold">Rating severity</span>
                      <strong className="text-cyan-400">{severity}/10</strong>
                    </div>
                  </div>

                  <div className="border-t border-white/5 my-1" />

                  <div className="flex flex-col gap-0.5">
                    <span className="text-[9px] text-slate-500 uppercase font-semibold">Hypothesized Root Cause</span>
                    <p className="text-white italic leading-relaxed">
                      "{rootCause || "Analyzing structural context..."}"
                    </p>
                  </div>

                  <div className="border-t border-white/5 my-1" />

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[9px] text-slate-500 uppercase font-semibold">Affected Population</span>
                      <strong className="text-white">{affectedPopulation} residents</strong>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[9px] text-slate-500 uppercase font-semibold">Urgency Level</span>
                      <strong className={`capitalize ${
                        severity >= 8 ? "text-red-400" : severity >= 5 ? "text-orange-400" : "text-yellow-400"
                      }`}>
                        {severity >= 8 ? "critical" : severity >= 5 ? "high" : severity >= 3 ? "medium" : "low"}
                      </strong>
                    </div>
                  </div>

                  <div className="border-t border-white/5 my-1" />

                  <div className="flex flex-col gap-0.5">
                    <span className="text-[9px] text-slate-500 uppercase font-semibold">Recommended Resolution</span>
                    <p className="text-slate-300 leading-snug">
                      Repair/resolve {category} fault on {streetName || "targeted street"}.
                    </p>
                  </div>
                </div>

                <div className="text-[10px] text-slate-500 flex items-start gap-1.5 p-2 border border-white/5 rounded-xl">
                  <Info className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                  <p className="leading-tight">
                    Incident DNA is processed using Gemini Vision's 14-point municipal failure taxonomy model.
                  </p>
                </div>

              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center py-12 text-slate-500">
                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3">
                  <Layers className="w-6 h-6" />
                </div>
                <span className="font-bold text-slate-400 text-xs">Awaiting Visual Proof</span>
                <p className="text-[10px] text-slate-600 mt-1 max-w-[200px] leading-relaxed">
                  Upload an issue photo in Step 1 to trigger the Gemini Vision incident diagnostic models.
                </p>
              </div>
            )}

          </div>
        </div>

      </div>

      {/* Duplicate warning modal */}
      {showDuplicateModal && duplicateWarning && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md glass-card rounded-2xl border border-white/10 p-5 text-slate-200 flex flex-col gap-4">
            <div className="flex items-start gap-3 text-yellow-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <div>
                <h4 className="font-bold text-sm uppercase tracking-wide">Duplicate complaint logged</h4>
                <p className="text-[11px] text-slate-400 mt-1">
                  A similar issue was already registered near these coordinates in the last 7 days.
                </p>
              </div>
            </div>

            {/* Duplicate card */}
            <div className="p-3 bg-white/5 rounded-xl border border-white/5 text-xs flex flex-col gap-1.5">
              <span className="font-bold text-white">{duplicateWarning.title}</span>
              <p className="text-[11px] text-slate-400 line-clamp-2">{duplicateWarning.description}</p>
              <div className="flex justify-between items-center text-[10px] text-slate-500 mt-1">
                <span>📍 {duplicateWarning.address?.split(",")[0]}</span>
                <span>Status: {duplicateWarning.status}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-2">
              <button
                type="button"
                onClick={handleUpvoteExisting}
                disabled={loading}
                className="py-2.5 bg-cyan-500 text-black text-xs font-bold rounded-xl hover:bg-cyan-400 cursor-pointer transition-colors flex items-center justify-center gap-1.5 shadow-lg shadow-cyan-400/25"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Upvote & Verify (+5 pts)
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDuplicateModal(false);
                  handleSubmit(undefined, true);
                }}
                className="py-2.5 bg-transparent border border-white/10 text-slate-400 hover:text-white text-xs font-bold rounded-xl cursor-pointer transition-colors"
              >
                File Anyway
              </button>
            </div>
            
            <button
              onClick={() => setShowDuplicateModal(false)}
              className="text-center text-[10px] text-slate-500 hover:underline cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
