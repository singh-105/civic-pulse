export interface AnalysisResult {
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

export const callGemini = async (prompt: string, imageBase64?: string, systemInstruction?: string): Promise<string> => {
  const parts: any[] = [{ text: prompt }];
  
  if (imageBase64) {
    const base64Data = imageBase64.includes(',') 
      ? imageBase64.split(',')[1] 
      : imageBase64;
    parts.push({
      inline_data: {
        mime_type: 'image/jpeg',
        data: base64Data
      }
    });
  }

  const reqBody: any = {
    contents: [{ parts }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 1024
    }
  };

  if (systemInstruction) {
    reqBody.systemInstruction = {
      parts: [{ text: systemInstruction }]
    };
  }

  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY || "";
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reqBody)
    }
  );

  const data = await response.json();
  
  if (data.error) {
    console.error('Gemini error:', data.error);
    throw new Error(data.error.message);
  }
  
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return text.replace(/```json/g, '').replace(/```/g, '').trim();
};

/**
 * Analyzes a base64 encoded image using Gemini 2.0 REST API
 */
export async function analyzeImage(base64Image: string, customPrompt?: string): Promise<AnalysisResult> {
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
    const text = await callGemini(imageAnalysisPrompt, base64Image);
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
 * Generates text completions using Gemini 2.0 REST API
 */
export async function generateText(prompt: string, systemInstruction?: string): Promise<string> {
  try {
    const text = await callGemini(prompt, undefined, systemInstruction);
    return text.trim();
  } catch (error) {
    console.error("Gemini text generation failed:", error);
    return '{}';
  }
}
