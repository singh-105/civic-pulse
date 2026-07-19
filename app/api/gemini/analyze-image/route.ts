import { GoogleGenerativeAI } from "@google/generative-ai"
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { imageBase64 } = await req.json()
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY || ""
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })

    const rawData = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;
    const mimeMatch = imageBase64.match(/^data:([A-Za-z-+\/]+);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";

    const promptText = `You are CivicPulse AI for Indian municipal infrastructure.
Analyze this image carefully. Identify the PRIMARY civic issue.

RULES:
- Trash/waste/garbage/litter/dump = "GARBAGE"
- Road holes/broken road/damaged asphalt = "POTHOLE"
- Flooded road/standing water = "WATERLOGGING"
- Broken/missing streetlight = "STREETLIGHT"
- Open manhole/sewage = "SEWAGE"
- Illegal construction = "CONSTRUCTION"
- Fallen tree = "TREE"
- Anything else = "OTHER"

Look at image carefully. Do NOT default to POTHOLE.
Return ONLY valid JSON no markdown no explanation:
{"category":"GARBAGE","subcategory":"Illegal Dumping","severity":7,"rootCause":"Inadequate waste collection in locality","affectedPopulation":"200 residents","urgency":"High","recommendedFix":"Emergency waste removal and CCTV installation"}`;

    const response = await model.generateContent([
      promptText,
      {
        inlineData: {
          data: rawData,
          mimeType: mimeType
        }
      }
    ]);

    const text = response.response.text() || '{}'
    const clean = text.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim()
    
    try {
      return NextResponse.json(JSON.parse(clean))
    } catch {
      // Extract JSON from response if wrapped in text
      const match = clean.match(/\{[\s\S]*\}/)
      if (match) return NextResponse.json(JSON.parse(match[0]))
      throw new Error('Invalid JSON from AI')
    }

  } catch (error: any) {
    console.error('Gemini vision error:', error.message || error)
    return NextResponse.json({
      category: 'OTHER',
      subcategory: 'Unclassified',
      severity: 5,
      rootCause: 'AI analysis failed - fill manually',
      affectedPopulation: 'Unknown',
      urgency: 'Medium',
      recommendedFix: 'Manual inspection required',
      isFallback: true
    })
  }
}
