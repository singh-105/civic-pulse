import Groq from 'groq-sdk'
import { NextResponse } from 'next/server'

const groq = new Groq({ apiKey: process.env.NEXT_PUBLIC_GROQ_API_KEY || process.env.GROQ_API_KEY })

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json()
    
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1000,
      temperature: 0.3
    })
    
    return NextResponse.json({ 
      text: response.choices[0].message.content || '' 
    })
  } catch (error: any) {
    console.error('Groq generate error:', error.message)
    return NextResponse.json({ 
      text: '{"predictions":[],"riskLevel":"LOW","summary":"AI unavailable"}',
      isFallback: true 
    })
  }
}
