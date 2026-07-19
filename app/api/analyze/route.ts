import { NextRequest, NextResponse } from "next/server";
import { groqVision, groqJSON } from "@/lib/groq";

export async function POST(req: NextRequest) {
  try {
    const { image } = await req.json();
    if (!image) {
      return NextResponse.json({ error: "Missing image base64 data" }, { status: 400 });
    }

    const prompt = `Analyze this civic infrastructure issue image. Return ONLY valid JSON:
{
  "category": "POTHOLE|GARBAGE|WATERLOGGING|STREETLIGHT|SEWAGE|CONSTRUCTION|TREE|OTHER",
  "subcategory": "specific type",
  "severity": 7,
  "rootCause": "root cause in one sentence",
  "affectedArea": "estimated affected area",
  "urgency": "low|medium|high|critical",
  "recommendedFix": "recommended fix in one sentence",
  "affectedPopulation": 15
}`;

    const fallback = {
      category: 'OTHER',
      subcategory: 'Unclassified',
      severity: 5,
      rootCause: 'AI analysis temporarily unavailable',
      affectedArea: 'Local area',
      urgency: 'medium',
      recommendedFix: 'Manual inspection required',
      affectedPopulation: 15
    };

    let result;
    try {
      const text = await groqVision(prompt, image);
      const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
      try {
        result = JSON.parse(cleaned);
      } catch {
        const jsonStart = cleaned.indexOf('{');
        const jsonEnd = cleaned.lastIndexOf('}');
        if (jsonStart !== -1 && jsonEnd !== -1) {
          result = JSON.parse(cleaned.substring(jsonStart, jsonEnd + 1));
        } else {
          throw new Error('Invalid JSON from Groq Vision');
        }
      }
    } catch (err) {
      console.error('Groq Vision API analyze route failed, trying text/JSON helper:', err);
      result = await groqJSON(prompt + '\n\nImage provided separately.', fallback);
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("API Analyze Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to analyze image" },
      { status: 500 }
    );
  }
}
