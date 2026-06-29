import Groq from 'groq-sdk'
import { NextResponse } from 'next/server'

const groq = new Groq({ apiKey: process.env.NEXT_PUBLIC_GROQ_API_KEY || process.env.GROQ_API_KEY })

export async function POST(req: Request) {
  try {
    const { imageBase64 } = await req.json()

    const response = await groq.chat.completions.create({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages: [{
        role: 'user',
        content: [
          {
            type: 'text',
            text: `You are CivicPulse AI for Indian municipal infrastructure.
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
{"category":"GARBAGE","subcategory":"Illegal Dumping","severity":7,"rootCause":"Inadequate waste collection in locality","affectedPopulation":"200 residents","urgency":"High","recommendedFix":"Emergency waste removal and CCTV installation"}`
          },
          {
            type: 'image_url',
            image_url: {
              url: imageBase64.startsWith('data:') 
                ? imageBase64 
                : `data:image/jpeg;base64,${imageBase64}`
            }
          }
        ]
      }],
      max_tokens: 500,
      temperature: 0.1
    })

    const text = response.choices[0].message.content || '{}'
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
    console.error('Groq vision error:', error.message)
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
