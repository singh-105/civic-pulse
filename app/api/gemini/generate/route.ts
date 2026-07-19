import { callGemini } from "@/lib/gemini"
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json()
    const text = await callGemini(prompt)
    
    return NextResponse.json({ 
      text: text || '' 
    })
  } catch (error: any) {
    console.error('Gemini generate error:', error.message || error)
    return NextResponse.json({ 
      text: '{"predictions":[],"riskLevel":"LOW","summary":"AI unavailable"}',
      isFallback: true 
    })
  }
}
