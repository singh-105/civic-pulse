import { collection, query, getDocs, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { fetchWeatherForecast } from "@/lib/weather";
import { searchExa } from "@/lib/exa";
import { fetchNews } from "@/lib/newsdata";
import { groqJSON } from "@/lib/groq";

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

const generatePrediction = async (weatherData: any, issuesData: any, newsData: any) => {
  const month = new Date().getMonth();
  const isMonsoon = month >= 5 && month <= 9;

  const prompt = `You are a civic infrastructure analyst for Indian cities.
Weather: ${JSON.stringify(weatherData)}
Recent issues: ${JSON.stringify(issuesData)}
News: ${JSON.stringify(newsData)}

Predict infrastructure risk for next 7 days.`;

  const fallback = {
    predictions: [
      { category: 'pothole', risk: isMonsoon ? 'critical' : 'medium', reason: isMonsoon ? 'Monsoon worsens road surfaces' : 'Normal wear expected' },
      { category: 'waterlogging', risk: isMonsoon ? 'critical' : 'low', reason: isMonsoon ? 'Drain overflow risk during peak monsoon' : 'Dry conditions' },
      { category: 'garbage', risk: 'medium', reason: 'Collection backlogs in dense areas' },
      { category: 'streetlight', risk: 'low', reason: 'No weather impact expected' },
      { category: 'sewage', risk: isMonsoon ? 'high' : 'low', reason: isMonsoon ? 'Rain overload on aging pipes' : 'Normal flow' }
    ],
    riskLevel: isMonsoon ? 'HIGH' : 'MEDIUM',
    summary: isMonsoon
      ? 'Monsoon conditions elevate infrastructure risk. Potholes and waterlogging are critical concerns this week.'
      : 'Moderate infrastructure risk. Regular monitoring recommended.'
  };

  return groqJSON(prompt, fallback);
};

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

    // 4. Combine into news summary
    const combinedNews = [...newsData, ...exaData]
      .map((item, idx) => `[News ${idx + 1}] Title: ${item.title}. Info: ${item.description || item.snippet || ""}`)
      .join("\n");

    const result = await generatePrediction(weatherData, issuesSummary, combinedNews);
    
    const mappedPredictions: ZonePrediction[] = (result.predictions || []).map((p: any) => {
      let probability = 0.5;
      const risk = (p.risk || '').toLowerCase();
      if (risk === "critical") probability = 0.9;
      else if (risk === "high") probability = 0.75;
      else if (risk === "medium") probability = 0.6;
      else if (risk === "low") probability = 0.3;

      return {
        zone: city || "Mumbai",
        category: p.category,
        probability: probability,
        reasoning: p.reason || p.reasoning || ""
      };
    });

    return {
      lastUpdated: new Date().toISOString(),
      predictions: mappedPredictions,
    };
  } catch (error) {
    console.error("Decay predictions generation failed:", error);
    return getFallbackPredictions();
  }
}

function getFallbackPredictions(): DecayPredictionResult {
  const month = new Date().getMonth();
  const isMonsoon = month >= 5 && month <= 9;
  
  return {
    lastUpdated: new Date().toISOString(),
    predictions: [
      {
        zone: "Mumbai",
        category: "pothole",
        probability: isMonsoon ? 0.9 : 0.6,
        reasoning: isMonsoon ? "Monsoon season worsens road surfaces significantly" : "Normal wear and tear expected"
      },
      {
        zone: "Mumbai",
        category: "waterlogging",
        probability: isMonsoon ? 0.9 : 0.3,
        reasoning: isMonsoon ? "Peak monsoon drain overflow risk" : "Dry season minimal risk"
      },
      {
        zone: "Mumbai",
        category: "garbage",
        probability: 0.6,
        reasoning: "Collection backlogs common in dense urban areas"
      },
      {
        zone: "Mumbai",
        category: "streetlight",
        probability: 0.3,
        reasoning: "No significant weather impact expected"
      },
      {
        zone: "Mumbai",
        category: "sewage",
        probability: isMonsoon ? 0.75 : 0.3,
        reasoning: isMonsoon ? "Rain overload on aging sewage pipes" : "Normal flow conditions"
      }
    ],
  };
}
