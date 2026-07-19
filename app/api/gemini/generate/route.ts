import { GoogleGenerativeAI } from "@google/generative-ai"
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json()
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY || ""
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })

    const response = await model.generateContent(prompt)
    
    return NextResponse.json({ 
      text: response.response.text() || '' 
    })
  } catch (error: any) {
    console.error('Gemini generate error:', error.message || error)
    return NextResponse.json({ 
      text: '{"predictions":[],"riskLevel":"LOW","summary":"AI unavailable"}',
      isFallback: true 
    })
  }
}
