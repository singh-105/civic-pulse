import { groqText } from "@/lib/groq"
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json()
    const text = await groqText(prompt)
    
    return NextResponse.json({ 
      text: text || '' 
    })
  } catch (error: any) {
    console.error('Groq generate error:', error.message || error)
    return NextResponse.json({ 
      text: '{"predictions":[],"riskLevel":"LOW","summary":"AI unavailable"}',
      isFallback: true 
    })
  }
}
