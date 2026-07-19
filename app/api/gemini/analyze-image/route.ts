import { groqVision, groqJSON } from "@/lib/groq"
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { imageBase64 } = await req.json()

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

    let result;
    try {
      const text = await groqVision(promptText, imageBase64)
      const clean = text.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim()
      
      try {
        result = JSON.parse(clean)
      } catch {
        const match = clean.match(/\{[\s\S]*\}/)
        if (match) {
          result = JSON.parse(match[0])
        } else {
          throw new Error('Invalid JSON from Groq Vision')
        }
      }
    } catch (err) {
      console.error('Groq Vision analyze-image route failed, trying text/JSON helper:', err);
      const fallback = {
        category: 'OTHER',
        subcategory: 'Unclassified',
        severity: 5,
        rootCause: 'AI analysis failed - fill manually',
        affectedPopulation: 'Unknown',
        urgency: 'Medium',
        recommendedFix: 'Manual inspection required',
        isFallback: true
      };
      result = await groqJSON(promptText + '\n\nImage provided separately.', fallback);
    }

    return NextResponse.json(result)

  } catch (error: any) {
    console.error('Groq vision error:', error.message || error)
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
