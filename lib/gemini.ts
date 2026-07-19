import { GoogleGenerativeAI } from "@google/generative-ai";

function getGeminiClient() {
  const key = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY || "";
  if (!key) {
    throw new Error("Gemini API key not set");
  }
  return new GoogleGenerativeAI(key);
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
 * Analyzes a base64 encoded image using Gemini 1.5 Flash
 */
export async function analyzeImage(base64Image: string, customPrompt?: string): Promise<AnalysisResult> {
  // Direct client-side and server-side analysis
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
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const rawData = base64Image.replace(/^data:image\/\w+;base64,/, '');
    const mimeMatch = base64Image.match(/^data:([A-Za-z-+\/]+);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";

    const imagePart = {
      inlineData: {
        data: rawData,
        mimeType: mimeType
      }
    };

    const response = await model.generateContent([
      imageAnalysisPrompt,
      imagePart
    ]);

    const text = response.response.text() || '';

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
      throw new Error('Invalid JSON from Gemini');
    }
  } catch (error) {
    console.error("Gemini Vision analysis failed:", error);
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
 * Generates text completions using Gemini 1.5 Flash
 */
export async function generateText(prompt: string, systemInstruction?: string): Promise<string> {
  // Direct client-side and server-side text generation
  try {
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      systemInstruction: systemInstruction 
    });

    const response = await model.generateContent(prompt);
    return (response.response.text() || '').trim();
  } catch (error) {
    console.error("Gemini text generation failed:", error);
    return '{}';
  }
}
