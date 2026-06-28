import Groq from "groq-sdk";

function getGroqClient() {
  const key = process.env.GROQ_API_KEY || "";
  if (!key) {
    throw new Error("GROQ_API_KEY not set");
  }
  return new Groq({ apiKey: key });
}

interface AnalysisResult {
  category: string;
  subcategory: string;
  severity: number;
  rootCause: string;
  affectedArea?: string;
  affectedPopulation?: string;
  urgency: string;
  recommendedFix?: string;
  confidence?: number;
  isFallback?: boolean;
}

/**
 * Analyzes a base64 encoded image using Groq Llama-4 vision
 */
export async function analyzeImage(base64Image: string, customPrompt?: string): Promise<AnalysisResult> {
  if (typeof window !== "undefined") {
    // Client-side: route via proxy API endpoint to hide credentials
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: base64Image })
    });
    if (!res.ok) throw new Error("AI analysis service failed");
    return await res.json();
  }

  // Server-side
  const imageAnalysisPrompt = `You are an expert municipal infrastructure AI.
Analyze this image carefully and identify the EXACT civic issue visible.

Look for these categories in order of visual evidence:
- GARBAGE: Waste, trash, litter, garbage dumps, overflowing bins, debris piles
- POTHOLE: Road holes, damaged asphalt, road cracks, broken road surface
- WATERLOGGING: Flooded areas, water on road, drainage overflow
- STREETLIGHT: Broken/missing lights, electrical poles damaged
- SEWAGE: Open manholes, sewage overflow, drain blockage
- CONSTRUCTION: Illegal construction, encroachment, unauthorized building
- GRAFFITI: Vandalism, graffiti on walls
- TREE: Fallen trees, dangerous branches
- OTHER: Any other civic issue

Return ONLY valid JSON, no markdown, no explanation:
{
  "category": "GARBAGE",
  "subcategory": "Waste Dumping",
  "severity": 7,
  "rootCause": "Inadequate waste collection frequency in residential area",
  "affectedPopulation": "50 residents",
  "urgency": "High",
  "recommendedFix": "Immediate waste collection and daily monitoring",
  "confidence": 0.95
}

Be accurate. Base category ONLY on what you visually see in image.
Do NOT default to pothole. Look at actual image content.`;

  try {
    const groq = getGroqClient();
    const rawData = base64Image.replace(/^data:image\/\w+;base64,/, '');
    const mimeMatch = base64Image.match(/^data:([A-Za-z-+\/]+);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";

    const response = await groq.chat.completions.create({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: imageAnalysisPrompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${rawData}`
              }
            }
          ]
        }
      ]
    });

    const text = response.choices[0].message?.content || '';

    // Strip any markdown if present
    const clean = text.replace(/```json|```/g, '').trim();
    try {
      return JSON.parse(clean);
    } catch {
      const jsonStart = clean.indexOf('{');
      const jsonEnd = clean.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1) {
        return JSON.parse(clean.substring(jsonStart, jsonEnd + 1));
      }
      throw new Error('Invalid JSON from Groq');
    }
  } catch (error) {
    console.error("Groq Vision analysis failed:", error);
    // Fallback Mock Data if it fails
    return {
      category: "OTHER",
      subcategory: "Unclassified",
      severity: 5,
      rootCause: "AI analysis temporarily unavailable",
      affectedPopulation: "Unknown",
      urgency: "Medium",
      recommendedFix: "Manual inspection required",
      confidence: 0.5,
      isFallback: true
    };
  }
}

/**
 * Generates text completions using Groq Llama 3.3
 */
export async function generateText(prompt: string, systemInstruction?: string): Promise<string> {
  if (typeof window !== "undefined") {
    // Client-side: proxy requests securely to the backend
    const res = await fetch("/api/gemini", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, systemInstruction })
    });
    const data = await res.json();
    return data.text || '{}';
  }

  // Server-side
  try {
    const groq = getGroqClient();
    const messages: any[] = [];
    if (systemInstruction) {
      messages.push({ role: 'system', content: systemInstruction });
    }
    messages.push({ role: 'user', content: prompt });

    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages,
      max_tokens: 1000
    });

    return (response.choices[0].message?.content || '').trim();
  } catch (error) {
    console.error("Groq text generation failed:", error);
    return '{}';
  }
}
