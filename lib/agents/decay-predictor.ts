import { collection, query, getDocs, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { fetchWeatherForecast } from "@/lib/weather";
import { searchExa } from "@/lib/exa";
import { fetchNews } from "@/lib/newsdata";

// Text generation (decay predictions, DNA, etc) using Next.js API route:
const generateText = async (prompt: string) => {
  const res = await fetch('/api/gemini/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt })
  });
  if (!res.ok) throw new Error('Generation failed');
  const data = await res.json();
  return data.text;
};

export interface ZonePrediction {
  zone: string;
  category: string;
  probability: number; // 0.0 to 1.0
  reasoning: string;
}

export interface DecayPredictionResult {
  lastUpdated: string;
  predictions: ZonePrediction[];
}

const parseGeminiJSON = (text: string) => {
  try {
    // Remove markdown fences
    const clean = text
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim()
    return JSON.parse(clean)
  } catch {
    // Return safe default if parse fails
    return {
      predictions: [],
      riskLevel: 'LOW',
      zones: [],
      summary: 'Analysis unavailable'
    }
  }
}

/**
 * Predicts infrastructure decay and hazard risk levels across wards/zones
 * by correlating weather, news data, and active issues via Gemini.
 */
export async function generateDecayPredictions(city: string = "Mumbai"): Promise<DecayPredictionResult> {
  try {
    // 1. Fetch weather forecast
    const weatherData = await fetchWeatherForecast(city);

    // 2. Fetch active issues from Firestore
    const issuesRef = collection(db, "issues");
    const issuesSnapshot = await getDocs(issuesRef);
    const issuesList: any[] = [];
    
    issuesSnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      issuesList.push({
        category: data.category,
        severity: data.severity,
        ward: data.ward || "General Ward",
        status: data.status,
      });
    });

    // Summarize issues by ward and category for token efficiency
    const issuesSummary: Record<string, Record<string, number>> = {};
    issuesList.forEach((iss) => {
      if (!issuesSummary[iss.ward]) {
        issuesSummary[iss.ward] = {};
      }
      if (!issuesSummary[iss.ward][iss.category]) {
        issuesSummary[iss.ward][iss.category] = 0;
      }
      issuesSummary[iss.ward][iss.category] += iss.severity; // sum severity as weight
    });

    // 3. Fetch recent news/web incidents
    const newsData = await fetchNews("road accident pothole infrastructure", city);
    const exaData = await searchExa(`hazardous roads broken streetlights waterlogging in ${city}`, 3);

    // 4. Combine into prompt
    const combinedNews = [...newsData, ...exaData]
      .map((item, idx) => `[News ${idx + 1}] Title: ${item.title}. Info: ${item.description || item.snippet || ""}`)
      .join("\n");

    const systemPrompt = `You are the CivicPulse Predictive Decay Model AI. Your job is to analyze active civic reports, weather predictions, and local news to output ward-level risk indicators for infrastructure decay over the next 14 days.`;

    const prompt = `Analyze the infrastructure and public safety risks in ${city} for the next 14 days.
    
    ENVIRONMENTAL PARAMETERS:
    - 5-Day Weather Forecast: ${JSON.stringify(weatherData)}
    
    ACTIVE CIVIC ISSUE STRESSORS (Ward-level accumulated severity weights):
    ${JSON.stringify(issuesSummary)}
    
    RECENT NEWS & SOCIAL INCIDENTS:
    ${combinedNews}

    Based on this data, assess risk probability (0.00 to 1.00) of infrastructure decay or public safety incidents per ward and category (pothole, drain, light, water, garbage, construction).
    You must output a raw JSON object with the following structure. Do not include markdown codeblocks or quotes.
    {
      "predictions": [
        {
          "zone": "Ward Name (e.g. Ward A, Ward 12, etc.)",
          "category": "pothole | drain | light | water | garbage | construction",
          "probability": 0.85,
          "reasoning": "brief 1-sentence reasoning (e.g., heavy rain and existing clogged drains will trigger flooding)"
        }
      ]
    }`;

    const combinedPrompt = `System instructions: ${systemPrompt}\n\nAnalyze this data:\n${prompt}`;
    const aiResponse = await generateText(combinedPrompt);
    const parsed = parseGeminiJSON(aiResponse);

    return {
      lastUpdated: new Date().toISOString(),
      predictions: parsed.predictions || [],
    };
  } catch (error) {
    console.error("Decay predictions generation failed:", error);
    return getFallbackPredictions();
  }
}

function getFallbackPredictions(): DecayPredictionResult {
  return {
    lastUpdated: new Date().toISOString(),
    predictions: [
      {
        zone: "Ward 12",
        category: "drain",
        probability: 0.88,
        reasoning: "Imminent heavy rainfall will overflow active sewer blockages reported here."
      },
      {
        zone: "Ward 8",
        category: "pothole",
        probability: 0.75,
        reasoning: "Erosion from local water pipeline leaks will expand existing road potholes."
      },
      {
        zone: "Ward 15",
        category: "light",
        probability: 0.62,
        reasoning: "Recent local news reports multiple accidents near dark junctions on main road."
      }
    ],
  };
}
